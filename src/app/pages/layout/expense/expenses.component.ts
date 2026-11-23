import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerModule } from '@syncfusion/ej2-angular-calendars';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { ReceiptImageService } from '../../../services/receipt-image.service';
import { ReceiptService } from '../../../services/receipt.service';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money, shortDate, shortDateWithYear, isoUtcDate, isoDate } from '../../../_helpers/money';

interface CategoryOption {
  id: number;
  name: string;
}

/** One expense line as this page renders it. */
interface LedgerExpense {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  /** Display date; also the source for the edit form. */
  date: string | null;
  /** null for expenses entered by hand rather than from a scanned receipt. */
  receiptId: number | null;
}

/** A receipt header plus the line items it owns. */
interface ReceiptLedgerRow {
  id: number;
  merchant: string | null;
  invoiceNo: string | null;
  date: string;
  grossTotal: number;
  discount: number;
  netPayable: number;
  totalItems: number;
  expenses: LedgerExpense[];
  /** True when the API holds a softcopy for this receipt. */
  hasImage: boolean;
}

/** Expenses bucketed by receipt, for the "group by receipts" view. */
interface ExpenseGroup {
  key: string;
  label: string;
  sublabel: string;
  total: number;
  expenses: LedgerExpense[];
}

export type LedgerView = 'expenses' | 'receipts';

/**
 * One control for both views. Encoding field and direction in a single value
 * keeps the UI to one select: "date, latest first" is the default the ledger
 * opens with, and reversing or switching to amount is one choice, not two.
 */
export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc', label: 'Date · latest first' },
  { key: 'date-asc', label: 'Date · oldest first' },
  { key: 'amount-desc', label: 'Amount · high to low' },
  { key: 'amount-asc', label: 'Amount · low to high' },
];

/**
 * Builds a comparator for the active sort. `date-desc` puts the newest row on
 * top, which is how the ledger reads by default; amount sorting falls back to
 * the same date order so equal amounts do not shuffle between renders.
 */
function sortComparator<T>(
  sortKey: SortKey,
  dateOf: (row: T) => string | null,
  amountOf: (row: T) => number
): (a: T, b: T) => number {
  const byAmount = sortKey.startsWith('amount');
  const ascending = sortKey.endsWith('asc');

  return (a, b) => {
    const amountDelta = amountOf(a) - amountOf(b);
    const dateDelta = dateValue(dateOf(a)) - dateValue(dateOf(b));

    if (byAmount && amountDelta !== 0) {
      return ascending ? amountDelta : -amountDelta;
    }

    // Newest first unless explicitly ascending.
    return ascending ? dateDelta : -dateDelta;
  };
}

/**
 * The ledger — two views over the same data.
 *
 * `expenses` lists individual lines with search, category filter and an optional
 * receipt grouping. `receipts` lists receipt headers; a row expands in place to
 * reveal the lines it owns, which is why the receipts endpoint returns each
 * receipt with its expenses already loaded.
 */
@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePickerModule,
    NumericTextBoxModule,
    MobileBarComponent,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.css',
})
export class ExpensesComponent implements OnInit {
  readonly money = money;
  readonly shortDate = shortDate;
  /** Ledger date cells carry the year, so 2023 and 2026 rows are distinguishable. */
  readonly shortDateWithYear = shortDateWithYear;

  /* ------------------------------------------------------------------ form */

  title = '';
  categoryId: number | null = null;
  quantity: number | null = 1;
  unitPrice: number | null = null;
  amount: number | null = null;
  date: Date = new Date();

  readonly categories = signal<CategoryOption[]>([]);
  readonly saving = signal(false);
  readonly saveError = signal(false);

  /* ---------------------------------------------------------------- ledger */

  readonly view = signal<LedgerView>('expenses');
  readonly rows = signal<LedgerExpense[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly filterCategory = signal<number | 'all'>('all');

  /** Shared by both views — the ledger opens on newest-first. */
  readonly sortKey = signal<SortKey>('date-desc');
  readonly sortOptions = SORT_OPTIONS;

  /** Group the flat expense list by the receipt it came from. */
  readonly groupByReceipt = signal(false);

  readonly receipts = signal<ReceiptLedgerRow[]>([]);
  readonly receiptsLoading = signal(true);
  readonly receiptsError = signal('');
  /** Receipt id whose line items are expanded; only one open at a time. */
  readonly expandedReceipt = signal<number | null>(null);

  /** Free-text filter for the receipts view: shop, invoice or a line item. */
  readonly receiptSearch = signal('');

  /* ------------------------------------------------------------ receipt photo */

  /** Receipt whose photo is open in the viewer, if any. */
  readonly photoFor = signal<ReceiptLedgerRow | null>(null);
  /** Short-lived signed URL; the bucket itself stays private. */
  readonly photoUrl = signal<string | null>(null);
  readonly photoLoading = signal(false);
  readonly photoError = signal('');
  /** One silent refetch when a cached URL has expired; a second failure is shown. */
  private photoRetried = false;

  /* --------------------------------------------------------------- editing */

  readonly editDraft = signal<EditDraft | null>(null);
  readonly editSaving = signal(false);
  readonly editError = signal('');
  readonly deletingId = signal<number | null>(null);

  readonly pageSize = 8;
  readonly page = signal(1);

  private readonly categoryNames = computed(
    () => new Map(this.categories().map((c) => [c.id, c.name]))
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cat = this.filterCategory();

    return this.rows().filter((r) => {
      if (cat !== 'all' && r.categoryId !== cat) return false;
      if (!term) return true;
      return (
        r.title.toLowerCase().includes(term) ||
        r.categoryName.toLowerCase().includes(term)
      );
    });
  });

  /** `filtered` in the user's chosen order — this is what both views render. */
  readonly sortedRows = computed(() => {
    const compare = sortComparator<LedgerExpense>(
      this.sortKey(),
      (row) => row.date,
      (row) => row.amount
    );
    return [...this.filtered()].sort(compare);
  });

  /** Same control, applied to receipt headers (ordered by net payable). */
  readonly sortedReceipts = computed(() => {
    const compare = sortComparator<ReceiptLedgerRow>(
      this.sortKey(),
      (row) => row.date,
      (row) => row.netPayable
    );
    return [...this.filteredReceipts()].sort(compare);
  });

  /**
   * The receipts view searches the whole collection client-side: the collection
   * is already loaded, and a shop name, invoice number or a line item ("milk")
   * are all things a user would type. Composes with the sort above.
   */
  readonly filteredReceipts = computed(() => {
    const term = this.receiptSearch().trim().toLowerCase();
    if (!term) return this.receipts();

    return this.receipts().filter((receipt) => {
      const haystack = [
        receipt.merchant ?? '',
        receipt.invoiceNo ?? '',
        ...receipt.expenses.map((line) => line.title),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sortedRows().length / this.pageSize))
  );

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.sortedRows().slice(start, start + this.pageSize);
  });

  readonly grandTotal = computed(() =>
    this.filtered().reduce((sum, r) => sum + r.amount, 0)
  );

  readonly receiptsTotal = computed(() =>
    this.receipts().reduce((sum, r) => sum + r.netPayable, 0)
  );

  /**
   * The flat list bucketed by receipt. Groups stay ordered by their own total
   * (biggest first, "no receipt" last) — that is a grouping summary, not a row
   * order — but the line items inside each group follow the chosen sort.
   */
  readonly groups = computed<ExpenseGroup[]>(() => {
    const byReceipt = new Map<string, ExpenseGroup>();
    const receiptById = new Map(this.receipts().map((r) => [r.id, r]));

    for (const expense of this.sortedRows()) {
      const key = expense.receiptId == null ? 'none' : String(expense.receiptId);
      let group = byReceipt.get(key);

      if (!group) {
        const receipt = expense.receiptId == null ? null : receiptById.get(expense.receiptId);
        group = {
          key,
          label: receipt
            ? receipt.merchant?.trim() || `Receipt #${receipt.id}`
            : 'No receipt',
          sublabel: receipt
            ? `${shortDate(receipt.date)}${receipt.invoiceNo ? ` · Invoice ${receipt.invoiceNo}` : ''}`
            : 'Entered by hand',
          total: 0,
          expenses: [],
        };
        byReceipt.set(key, group);
      }

      group.expenses.push(expense);
      group.total += expense.amount;
    }

    return [...byReceipt.values()].sort((a, b) => {
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      return b.total - a.total;
    });
  });

  /**
   * Getters rather than computed() signals: these read plain form fields, which
   * never mark a computed dirty — a computed would cache its first result and
   * keep the Add button disabled even with everything filled in.
   */
  get computedAmount(): number {
    if (this.amount != null && this.amount > 0) return this.amount;
    const q = this.quantity ?? 0;
    const u = this.unitPrice ?? 0;
    return q > 0 && u > 0 ? q * u : 0;
  }

  get canSave(): boolean {
    return (
      this.title.trim().length > 0 &&
      this.categoryId != null &&
      this.computedAmount > 0 &&
      !this.saving()
    );
  }

  constructor(
    private expenseService: ExpenseService,
    private expenseCategoryService: ExpenseCategoryService,
    private receiptService: ReceiptService,
    private receiptImageService: ReceiptImageService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadRows();
    this.loadReceipts();
  }

  /* ------------------------------------------------------------------ load */

  private loadCategories(): void {
    this.expenseCategoryService.getAll().subscribe({
      next: (data: any[]) =>
        this.categories.set((data ?? []).map((c) => ({ id: c.id, name: c.name }))),
      // The form still works; the category list is simply empty.
      error: () => this.categories.set([]),
    });
  }

  private loadRows(): void {
    this.loading.set(true);
    this.expenseService.getAll().subscribe({
      next: (data: any[]) => {
        const mapped: LedgerExpense[] = (data ?? []).map((e) => ({
          id: e.id,
          title: e.cause ?? 'Expense',
          categoryId: e.expenseCategoryId ?? null,
          categoryName: this.categoryLabel(e.expenseCategoryId),
          amount: Number(e.amount) || 0,
          quantity: e.quantity ?? null,
          unitPrice: e.unitPrice ?? null,
          date: e.expenseDate ?? e.entryDate ?? null,
          receiptId: e.receiptId ?? null,
        }));

        // Ordering is the `sortedRows` computed's job, so a change of sort does
        // not need a reload.
        this.rows.set(mapped);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadReceipts(): void {
    this.receiptsLoading.set(true);
    this.receiptsError.set('');

    this.receiptService.getAll().subscribe({
      next: (data: any[]) => {
        const mapped: ReceiptLedgerRow[] = (data ?? []).map((r) => ({
          id: r.id,
          merchant: r.merchant ?? null,
          invoiceNo: r.invoiceNo ?? null,
          date: r.receiptDateTime ?? r.entryDate ?? new Date().toISOString(),
          grossTotal: Number(r.grossTotal) || 0,
          discount: Number(r.discount) || 0,
          netPayable: Number(r.netPayable) || 0,
          totalItems: Number(r.totalItems) || (r.expenses?.length ?? 0),
          hasImage: r.hasImage === true,
          expenses: (r.expenses ?? []).map((e: any) => ({
            id: e.id,
            title: e.cause ?? 'Expense',
            categoryId: e.expenseCategoryId ?? null,
            categoryName: this.categoryLabel(e.expenseCategoryId),
            amount: Number(e.amount) || 0,
            quantity: e.quantity ?? null,
            unitPrice: e.unitPrice ?? null,
            date: e.expenseDate ?? e.entryDate ?? null,
            receiptId: e.receiptId ?? r.id,
          })),
        }));

        // Ordering comes from `sortedReceipts`, not the load, so switching sort
        // re-orders without a round trip.
        this.receipts.set(mapped);
        this.receiptsLoading.set(false);
      },
      error: () => {
        this.receipts.set([]);
        this.receiptsLoading.set(false);
        this.receiptsError.set('Could not load receipts.');
      },
    });
  }

  /** The API returns a category id; the name lives in the categories list. */
  private categoryLabel(categoryId: number | null | undefined): string {
    if (categoryId == null) return 'Uncategorised';
    return this.categoryNames().get(categoryId) ?? 'Uncategorised';
  }

  /* ----------------------------------------------------------------- views */

  setView(view: LedgerView): void {
    this.view.set(view);
    // A receipt that was open in one view should not stay open in the other.
    this.expandedReceipt.set(null);
    this.closePhoto();
  }

  toggleGrouping(): void {
    this.groupByReceipt.update((on) => !on);
    this.page.set(1);
  }

  toggleReceipt(id: number): void {
    this.expandedReceipt.update((open) => (open === id ? null : id));
  }

  isExpanded(id: number): boolean {
    return this.expandedReceipt() === id;
  }

  /* ------------------------------------------------------------ receipt photo */

  onReceiptSearch(value: string): void {
    this.receiptSearch.set(value);
  }

  /**
   * Opens the softcopy viewer. Stops the click/keydown from reaching the row,
   * which would otherwise toggle the receipt's line items behind the modal.
   */
  openPhoto(receipt: ReceiptLedgerRow, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!receipt.hasImage) return;

    this.photoFor.set(receipt);
    this.photoUrl.set(null);
    this.photoError.set('');
    this.photoLoading.set(true);

    this.receiptImageService.getUrl(receipt.id).subscribe({
      next: (response) => {
        this.photoUrl.set(response.url);
        this.photoLoading.set(false);
      },
      error: (error) => {
        this.photoLoading.set(false);
        this.photoError.set(
          error?.status === 404
            ? 'No photo saved for this receipt.'
            : 'The receipt photo could not be loaded. Please try again.'
        );
      },
    });
  }

  closePhoto(): void {
    this.photoFor.set(null);
    this.photoUrl.set(null);
    this.photoError.set('');
    this.photoLoading.set(false);
    this.photoRetried = false;
  }

  /**
   * A presigned URL lives five minutes, so a modal left open can outlive it.
   * Refetch once; if the second attempt fails too, say so instead of showing a
   * broken image.
   */
  onPhotoLoadError(): void {
    const receipt = this.photoFor();
    if (!receipt) return;

    if (this.photoRetried) {
      this.photoUrl.set(null);
      this.photoError.set('The receipt photo could not be displayed.');
      return;
    }

    this.photoRetried = true;
    this.openPhoto(receipt);
  }

  /* ---------------------------------------------------------------- filters */

  onQuantity(value: number | null): void {
    this.quantity = value;
    this.syncAmount();
  }

  onUnitPrice(value: number | null): void {
    this.unitPrice = value;
    this.syncAmount();
  }

  /** Keep amount in step with qty x unit price, unless the user typed one. */
  private syncAmount(): void {
    const q = this.quantity ?? 0;
    const u = this.unitPrice ?? 0;
    if (q > 0 && u > 0) this.amount = q * u;
  }

  onDateChange(value: Date | null): void {
    if (value) this.date = value;
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  onFilterCategory(value: string): void {
    this.filterCategory.set(value === 'all' ? 'all' : Number(value));
    this.page.set(1);
  }

  onSortChange(value: string): void {
    this.sortKey.set(value as SortKey);
    // Row order changed, so page 1 is the only page guaranteed to still make sense.
    this.page.set(1);
  }

  goToPage(next: number): void {
    this.page.set(Math.min(Math.max(1, next), this.pageCount()));
  }

  /* ------------------------------------------------------------------ save */

  save(): void {
    if (!this.canSave) return;

    this.saving.set(true);

    const payload = {
      cause: this.title.trim(),
      amount: this.computedAmount,
      quantity: this.quantity ?? 1,
      unitPrice: this.unitPrice ?? this.computedAmount,
      expenseDate: isoUtcDate(this.date),
      expenseCategoryId: this.categoryId,
    };

    this.expenseService.create(payload as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.loadRows();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set(true);
      },
    });
  }

  clear(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.title = '';
    this.categoryId = null;
    this.quantity = 1;
    this.unitPrice = null;
    this.amount = null;
    this.date = new Date();
    this.saveError.set(false);
  }

  /* ------------------------------------------------------------------ edit */

  startEdit(row: LedgerExpense): void {
    this.editError.set('');
    this.editDraft.set({
      id: row.id,
      title: row.title,
      categoryId: row.categoryId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      amount: row.amount,
      date: isoDate(row.date),
    });
  }

  cancelEdit(): void {
    this.editDraft.set(null);
    this.editError.set('');
  }

  patchDraft(partial: Partial<EditDraft>): void {
    this.editDraft.update((draft) => (draft ? { ...draft, ...partial } : draft));
  }

  saveEdit(): void {
    const draft = this.editDraft();
    if (!draft || this.editSaving()) return;

    const amount =
      draft.amount != null && draft.amount > 0
        ? draft.amount
        : (draft.quantity ?? 0) * (draft.unitPrice ?? 0);

    if (!draft.title.trim() || amount <= 0) {
      this.editError.set('A title and an amount above zero are required.');
      return;
    }

    this.editSaving.set(true);
    this.editError.set('');

    // The controller requires the body's id to match the route, and treats
    // CreatedBy/EntryDate as server-owned, so they are omitted deliberately.
    const payload = {
      id: draft.id,
      cause: draft.title.trim(),
      amount,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      expenseDate: `${draft.date}T00:00:00.000Z`,
      expenseCategoryId: draft.categoryId,
    };

    this.expenseService.update(draft.id, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.editDraft.set(null);
        this.loadRows();
        this.loadReceipts();
      },
      error: () => {
        this.editSaving.set(false);
        this.editError.set('Could not save the change. Please try again.');
      },
    });
  }

  /* ---------------------------------------------------------------- delete */

  remove(row: LedgerExpense): void {
    if (this.deletingId() != null) return;

    const confirmed = window.confirm(`Delete "${row.title}"? This cannot be undone.`);
    if (!confirmed) return;

    this.deletingId.set(row.id);
    this.expenseService.delete(row.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.rows.update((rows) => rows.filter((r) => r.id !== row.id));
        // The receipt header keeps its scanned totals; only the line disappears.
        this.loadReceipts();
      },
      error: () => {
        this.deletingId.set(null);
        window.alert('Could not delete that expense.');
      },
    });
  }
}

interface EditDraft {
  id: number;
  title: string;
  categoryId: number | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  /** `yyyy-MM-dd`, from a native date input. */
  date: string;
}

function dateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
