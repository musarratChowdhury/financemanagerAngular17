import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatePickerModule } from '@syncfusion/ej2-angular-calendars';
import { DropDownListModule } from '@syncfusion/ej2-angular-dropdowns';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money, moneyExact, isoDate, longDate } from '../../../_helpers/money';

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
 * NOTE ON OCR: the API exposes no receipt-parsing endpoint, so nothing is read
 * automatically. The review step starts empty and tells the user so, rather
 * than showing invented confidence scores. What *is* real: the category
 * suggestion (matched against your own category names) and the arithmetic
 * check on every line item.
 */
@Component({
  selector: 'app-scan-receipt',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePickerModule,
    DropDownListModule,
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

  /* ------------------------------------------------------------- review */

  shop = '';
  date: Date = new Date();
  categoryId: number | null = null;
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

  readonly itemsMatchTotal = computed(() => {
    const total = this.total ?? 0;
    if (!this.items().length || total <= 0) return true;
    return Math.abs(this.itemsTotal() - total) < 0.01;
  });

  /** The category whose name best matches the shop text, if any. */
  readonly suggestedCategoryId = computed(() => {
    const haystack = this.shop.trim().toLowerCase();
    if (!haystack) return null;
    const hit = this.categories().find((c) => {
      const name = c.name.toLowerCase();
      return haystack.includes(name) || name.includes(haystack);
    });
    return hit?.id ?? null;
  });

  readonly canReview = computed(() => this.fileName().length > 0);

  readonly canSave = computed(
    () =>
      this.shop.trim().length > 0 &&
      this.categoryId != null &&
      (this.total ?? 0) > 0 &&
      !this.saving()
  );

  constructor(
    private expenseService: ExpenseService,
    private expenseCategoryService: ExpenseCategoryService,
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
    const id = this.suggestedCategoryId();
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
    this.date = new Date();
    this.categoryId = null;
    this.total = null;
    this.items.set([]);
    this.saveError.set('');
    this.step.set(1);
  }

  save(): void {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.saveError.set('');

    const categoryId = this.categoryId!;
    const expenseDate = isoDate(this.date);
    const items = this.items().filter((i) => i.name.trim().length > 0);

    // One expense per line item keeps the ledger meaningful; with no line items
    // the whole receipt becomes a single expense.
    const payloads = items.length
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

    let remaining = payloads.length;
    let failed = false;

    for (const payload of payloads) {
      this.expenseService.create(payload as any).subscribe({
        next: () => {
          remaining--;
          if (remaining === 0) this.finish(failed);
        },
        error: () => {
          failed = true;
          remaining--;
          if (remaining === 0) this.finish(failed);
        },
      });
    }
  }

  private finish(failed: boolean): void {
    this.saving.set(false);

    if (failed) {
      this.saveError.set(
        'Some of these expenses could not be saved. Check the ledger before retrying.'
      );
      return;
    }

    const previous = this.previewUrl();
    if (previous) URL.revokeObjectURL(previous);

    this.router.navigate(['/expenses']);
  }
}
