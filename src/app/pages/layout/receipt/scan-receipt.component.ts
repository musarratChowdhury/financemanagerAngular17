import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePickerModule } from '@syncfusion/ej2-angular-calendars';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { ReceiptModelService } from '../../../services/receipt-model.service';
import { ReceiptService } from '../../../services/receipt.service';
import {
  ReceiptScanError,
  ReceiptScanResult,
  ReceiptScannerService,
} from '../../../services/receipt-scanner.service';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { Receipt } from '../../../../models/Receipt';
import { money, moneyExact, isoDate, isoUtcDate, longDate } from '../../../_helpers/money';

interface CategoryOption {
  id: number;
  name: string;
}

interface LineItem {
  key: number;
  name: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
}

/**
 * Scan receipt — upload, review, save.
 *
 * Mobile-first: one column, stepper scrolls horizontally if it must. From
 * 1024px the receipt preview and the review form sit side by side.
 *
 * Receipt data is read by the API and only prefills the review form; saving
 * always remains an explicit user action.
 */
@Component({
  selector: 'app-scan-receipt',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePickerModule,
    NumericTextBoxModule,
    MobileBarComponent,
  ],
  templateUrl: './scan-receipt.component.html',
  styleUrl: './scan-receipt.component.css',
})
export class ScanReceiptComponent implements OnInit {
  readonly money = money;
  readonly moneyExact = moneyExact;
  readonly longDate = longDate;

  readonly step = signal(1);
  readonly steps = ['Upload', 'Review', 'Save'];

  /* ------------------------------------------------------------- upload */

  readonly fileName = signal('');
  readonly previewUrl = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly fileError = signal('');
  readonly ocrStatus = signal<'idle' | 'scanning' | 'done' | 'unsupported' | 'error'>('idle');
  readonly ocrProgress = signal(0);
  readonly ocrMessage = signal('');

  /** Model asked for, and the model that actually answered (differs after a fallback). */
  readonly requestedModel = signal<string | null>(null);
  readonly usedModel = signal('');

  /** Gemini's raw error body for the last failed scan, shown verbatim. */
  readonly ocrRaw = signal('');

  /* ------------------------------------------------------------- review */

  shop = '';
  invoiceNo = '';
  date: Date = new Date();
  /** Time printed on the receipt, `HH:mm`. Empty when the scan found none. */
  receiptTime = '';
  categoryId: number | null = null;
  /** Total before discounts, as printed. */
  grossTotal: number | null = null;
  /** Discount applied, 0 when the receipt has none. */
  discount: number | null = null;
  /** Amount actually payable after the discount — the number that becomes the expense total. */
  total: number | null = null;

  readonly categories = signal<CategoryOption[]>([]);
  readonly items = signal<LineItem[]>([]);
  private nextKey = 1;

  /* --------------------------------------------------------------- save */

  readonly saving = signal(false);
  readonly saveError = signal('');

  /* ----------------------------------------------------------- computed */

  /** Sum of the line items — the number the receipt total should match. */
  readonly itemsTotal = computed(() =>
    this.items().reduce((sum, item) => sum + (item.amount ?? 0), 0)
  );

  /**
   * Getters rather than computed() signals where the logic reads plain form
   * fields (shop / total / categoryId): a computed only re-evaluates when a
   * signal it read changes, so those results would go stale forever after
   * their first evaluation with empty fields.
   */
  get itemsMatchTotal(): boolean {
    const total = this.total ?? 0;
    if (!this.items().length || total <= 0) return true;
    return Math.abs(this.itemsTotal() - total) < 0.01;
  }

  /** The category whose name best matches the shop text, if any. */
  get suggestedCategoryId(): number | null {
    const haystack = this.shop.trim().toLowerCase();
    if (!haystack) return null;
    const hit = this.categories().find((c) => {
      const name = c.name.toLowerCase();
      return haystack.includes(name) || name.includes(haystack);
    });
    return hit?.id ?? null;
  }

  readonly canReview = computed(() => this.fileName().length > 0);

  get canSave(): boolean {
    return (
      this.shop.trim().length > 0 &&
      this.categoryId != null &&
      (this.total ?? 0) > 0 &&
      !this.saving()
    );
  }

  constructor(
    private expenseCategoryService: ExpenseCategoryService,
    private receiptScanner: ReceiptScannerService,
    private receiptService: ReceiptService,
    private receiptModels: ReceiptModelService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.expenseCategoryService.getAll().subscribe({
      next: (data: any[]) =>
        this.categories.set((data ?? []).map((c) => ({ id: c.id, name: c.name }))),
      error: () => this.categories.set([]),
    });
  }

  /* --------------------------------------------------------------- upload */

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.acceptFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.acceptFile(file);
    // Allow re-picking the same file after a discard.
    input.value = '';
  }

  private acceptFile(file: File): void {
    const ok =
      /^image\/(jpeg|png|webp)$/.test(file.type) ||
      file.type === 'application/pdf' ||
      /\.(jpe?g|png|webp|pdf)$/i.test(file.name);

    if (!ok) {
      this.fileError.set('That file type is not supported. Use JPG, PNG or PDF.');
      return;
    }

    this.fileError.set('');
    this.fileName.set(file.name);

    // Revoke the previous object URL so we do not leak blobs on re-upload.
    const previous = this.previewUrl();
    if (previous) URL.revokeObjectURL(previous);

    this.previewUrl.set(
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    );
    this.step.set(2);

    void this.scanReceipt(file);
  }

  private async scanReceipt(file: File): Promise<void> {
    this.ocrStatus.set('scanning');
    this.ocrProgress.set(0);
    this.ocrMessage.set('Reading receipt…');
    this.ocrRaw.set('');

    const requested = this.receiptModels.model();
    this.requestedModel.set(requested);
    this.usedModel.set('');

    // Tell the background availability sweep to stand down: a scan is already
    // spending the key's quota and the user is waiting.
    this.receiptModels.scanInProgress.set(true);

    try {
      const parsed = await this.receiptScanner.recognize(file, requested);
      if (parsed.merchant) this.shop = parsed.merchant;
      if (parsed.invoiceNo) this.invoiceNo = parsed.invoiceNo;
      if (parsed.date) {
        const date = new Date(parsed.date);
        if (!Number.isNaN(date.getTime())) {
          this.date = date;
          // Only offer a time when the receipt actually printed one; a scan that
          // found just a date comes back as midnight.
          const hours = date.getUTCHours();
          const minutes = date.getUTCMinutes();
          this.receiptTime =
            hours || minutes
              ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
              : '';
        }
      }
      // Net payable is what was actually charged; gross is before the discount.
      if (parsed.total != null) this.total = parsed.total;
      if (parsed.discount != null) this.discount = parsed.discount;
      this.grossTotal =
        parsed.subtotal ??
        (parsed.total != null ? parsed.total + (parsed.discount ?? 0) : null);
      this.usedModel.set(parsed.modelUsed ?? requested ?? '');
      this.items.set(
        (parsed.items ?? []).map((item) => ({
          key: this.nextKey++,
          name: item.name,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        }))
      );
      this.ocrProgress.set(1);
      this.ocrStatus.set('done');
      this.ocrMessage.set(this.describeSuccess(parsed));
    } catch (error) {
      console.error('Receipt scan failed:', error);
      this.ocrStatus.set('error');
      this.ocrMessage.set(
        error instanceof Error && error.message
          ? `${error.message} Please enter the details manually.`
          : 'Could not read this receipt. Please enter the details manually.'
      );
      this.ocrRaw.set(
        error instanceof ReceiptScanError
          ? this.pretty(error.attempts.find((a) => a.rawResponse)?.rawResponse ?? '')
          : ''
      );
    } finally {
      this.receiptModels.scanInProgress.set(false);
    }
  }

  /** Success copy, including the honest note when the server had to fall back. */
  private describeSuccess(parsed: ReceiptScanResult): string {
    const base = parsed.needsReview
      ? 'Receipt read. Please check the highlighted totals and every field.'
      : 'Receipt read. Please review the fields before saving.';

    const used = this.usedModel();
    const requested = this.requestedModel();

    if (used && requested && used !== requested) {
      return `${base} ${requested} was unavailable, so this was read with ${used}.`;
    }

    return used ? `${base} Read with ${used}.` : base;
  }

  /** True when the server answered with a model other than the one we asked for. */
  get fellBack(): boolean {
    const used = this.usedModel();
    const requested = this.requestedModel();
    return !!used && !!requested && used !== requested;
  }

  private pretty(raw: string): string {
    if (!raw) return '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  useCamera(): void {
    // Camera capture is handled by the file input's `capture` attribute, so
    // this only needs to open the picker.
    document.getElementById('receipt-file')?.click();
  }

  /* --------------------------------------------------------------- review */

  addItem(): void {
    this.items.update((list) => [
      ...list,
      { key: this.nextKey++, name: '', qty: 1, unitPrice: null, amount: null },
    ]);
  }

  removeItem(key: number): void {
    this.items.update((list) => list.filter((i) => i.key !== key));
  }

  onItemQty(key: number, qty: number | null): void {
    this.patchItem(key, (item) => {
      const next = { ...item, qty };
      if (next.qty && next.unitPrice) next.amount = next.qty * next.unitPrice;
      return next;
    });
  }

  onItemUnit(key: number, unitPrice: number | null): void {
    this.patchItem(key, (item) => {
      const next = { ...item, unitPrice };
      if (next.qty && next.unitPrice) next.amount = next.qty * next.unitPrice;
      return next;
    });
  }

  onItemName(key: number, name: string): void {
    this.patchItem(key, (item) => ({ ...item, name }));
  }

  onItemAmount(key: number, amount: number | null): void {
    this.patchItem(key, (item) => ({ ...item, amount }));
  }

  private patchItem(key: number, fn: (item: LineItem) => LineItem): void {
    this.items.update((list) =>
      list.map((item) => (item.key === key ? fn(item) : item))
    );
  }

  /** True when qty x unit price disagrees with the typed amount. */
  isItemSuspect(item: LineItem): boolean {
    if (item.qty == null || item.unitPrice == null || item.amount == null) {
      return false;
    }
    return Math.abs(item.qty * item.unitPrice - item.amount) > 0.01;
  }

  applySuggestion(): void {
    const id = this.suggestedCategoryId;
    if (id != null) this.categoryId = id;
  }

  goToStep(step: number): void {
    // Only forward to review once a file exists.
    if (step === 2 && !this.canReview()) return;
    this.step.set(step);
  }

  /* ----------------------------------------------------------------- save */

  discard(): void {
    const previous = this.previewUrl();
    if (previous) URL.revokeObjectURL(previous);

    this.fileName.set('');
    this.previewUrl.set(null);
    this.shop = '';
    this.invoiceNo = '';
    this.date = new Date();
    this.receiptTime = '';
    this.categoryId = null;
    this.grossTotal = null;
    this.discount = null;
    this.total = null;
    this.items.set([]);
    this.saveError.set('');
    this.ocrStatus.set('idle');
    this.ocrProgress.set(0);
    this.ocrMessage.set('');
    this.ocrRaw.set('');
    this.requestedModel.set(null);
    this.usedModel.set('');
    this.step.set(1);
  }

  save(): void {
    if (!this.canSave || this.saving()) return;

    this.saving.set(true);
    this.saveError.set('');

    const categoryId = this.categoryId!;
    const expenseDate = isoUtcDate(this.date);
    const items = this.items().filter((i) => i.name.trim().length > 0);

    // One expense per line item keeps the ledger meaningful; with no line items
    // the whole receipt becomes a single expense.
    const expenses = items.length
      ? items.map((item) => ({
          cause: item.name.trim(),
          amount: item.amount ?? (item.qty ?? 1) * (item.unitPrice ?? 0),
          quantity: item.qty ?? 1,
          unitPrice: item.unitPrice ?? item.amount ?? 0,
          expenseDate,
          expenseCategoryId: categoryId,
        }))
      : [
          {
            cause: this.shop.trim(),
            amount: this.total!,
            quantity: 1,
            unitPrice: this.total!,
            expenseDate,
            expenseCategoryId: categoryId,
          },
        ];

    const netPayable = this.total!;
    const grossTotal = this.grossTotal ?? netPayable + (this.discount ?? 0);

    // One request for the receipt and all of its line items, so the server can
    // write them in a single save. The old per-item loop left half a receipt
    // behind whenever one request failed, and retrying duplicated the rest.
    const receipt: Receipt = {
      merchant: this.shop.trim() || null,
      invoiceNo: this.invoiceNo.trim() || null,
      grossTotal,
      discount: this.discount ?? 0,
      netPayable,
      totalItems: expenses.length,
      receiptDateTime: this.receiptDateTimeIso(),
      expenses,
    };

    this.receiptService.create(receipt).subscribe({
      next: () => {
        this.saving.set(false);
        const previous = this.previewUrl();
        if (previous) URL.revokeObjectURL(previous);
        this.router.navigate(['/expenses']);
      },
      error: (error) => {
        console.error('Receipt save failed:', error);
        this.saving.set(false);
        // Nothing is written on failure, so the message can be honest about it.
        this.saveError.set(
          error?.error?.message ??
            error?.message ??
            'The receipt could not be saved. Nothing was written — check the API and try again.'
        );
      },
    });
  }

  /**
   * The receipt's date and time as an ISO instant.
   *
   * The date comes from `isoDate()` (a plain `yyyy-MM-dd`) so the picked day is
   * stored exactly as chosen rather than being shifted by the browser's offset —
   * the same convention the expense date uses. The time, when the receipt printed
   * one, is appended verbatim.
   */
  private receiptDateTimeIso(): string {
    const day = isoDate(this.date);
    const match = /^(\d{1,2}):(\d{2})$/.exec(this.receiptTime.trim());

    if (!match) {
      return `${day}T00:00:00.000Z`;
    }

    const hours = match[1].padStart(2, '0');
    return `${day}T${hours}:${match[2]}:00.000Z`;
  }
}
