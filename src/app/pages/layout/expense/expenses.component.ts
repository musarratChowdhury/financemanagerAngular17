import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  DatePickerModule,
  DatePickerComponent,
} from '@syncfusion/ej2-angular-calendars';
import { DropDownListModule } from '@syncfusion/ej2-angular-dropdowns';
import { GridModule, PageService } from '@syncfusion/ej2-angular-grids';
import {
  NumericTextBoxModule,
  TextBoxModule,
} from '@syncfusion/ej2-angular-inputs';
import { ToastComponent } from '@syncfusion/ej2-angular-notifications';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { BudgetService } from '../../../services/budget.service';
import { ExpenseRow } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money, shortDate, isoDate, percent } from '../../../_helpers/money';

interface CategoryOption {
  id: number;
  name: string;
}

/**
 * Expenses — the add form and the ledger on one screen.
 *
 * Mobile-first: the form comes first (adding an expense is the primary action),
 * the ledger below it as tappable rows. From 1024px they sit side by side with
 * a Syncfusion Grid for the ledger.
 */
@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePickerModule,
    DropDownListModule,
    GridModule,
    TextBoxModule,
    NumericTextBoxModule,
    MobileBarComponent,
  ],
  providers: [PageService],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.css',
})
export class ExpensesComponent implements OnInit {
  readonly money = money;
  readonly shortDate = shortDate;
  readonly percent = percent;

  /* ------------------------------------------------------------------ form */

  title = '';
  categoryId: number | null = null;
  quantity: number | null = 1;
  unitPrice: number | null = null;
  amount: number | null = null;
  date: Date = new Date();

  readonly categories = signal<CategoryOption[]>([]);
  readonly saving = signal(false);

  /* ---------------------------------------------------------------- ledger */

  readonly rows = signal<ExpenseRow[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly filterCategory = signal<number | 'all'>('all');

  readonly pageSize = 8;
  readonly page = signal(1);

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

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly grandTotal = computed(() =>
    this.filtered().reduce((sum, r) => sum + r.amount, 0)
  );

  readonly scannedCount = computed(
    () => this.filtered().filter((r) => r.scanned).length
  );

  /** Total recalculated live as quantity or unit price changes. */
  readonly computedAmount = computed(() => {
    if (this.amount != null && this.amount > 0) return this.amount;
    const q = this.quantity ?? 0;
    const u = this.unitPrice ?? 0;
    return q > 0 && u > 0 ? q * u : 0;
  });

  readonly canSave = computed(
    () =>
      this.title.trim().length > 0 &&
      this.categoryId != null &&
      this.computedAmount() > 0 &&
      !this.saving()
  );

  constructor(
    private expenseService: ExpenseService,
    private expenseCategoryService: ExpenseCategoryService,
    private budgetService: BudgetService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadRows();
  }

  private loadCategories(): void {
    this.expenseCategoryService.getAll().subscribe({
      next: (data: any[]) => {
        this.categories.set(
          (data ?? []).map((c) => ({ id: c.id, name: c.name }))
        );
      },
      // The form still works; the category list is simply empty.
      error: () => this.categories.set([]),
    });
  }

  private loadRows(): void {
    this.loading.set(true);
    this.budgetService.loadMonth(
      new Date().getMonth() + 1,
      new Date().getFullYear()
    ).subscribe({
      next: (snapshot) => {
        // The month endpoint only returns category groups, so pull every
        // expense and filter locally — the ledger is not month-scoped.
        this.loadAllRows(snapshot.categories);
      },
      error: () => this.loadAllRows([]),
    });
  }

  private loadAllRows(fallbackCats: { categoryId: number; categoryName: string }[]): void {
    const catNames = new Map<number, string>();
    for (const c of this.categories()) catNames.set(c.id, c.name);
    for (const c of fallbackCats) {
      if (!catNames.has(c.categoryId)) catNames.set(c.categoryId, c.categoryName);
    }

    this.expenseService.getAll().subscribe({
      next: (data: any[]) => {
        const mapped: ExpenseRow[] = (data ?? []).map((e) => ({
          id: e.id,
          title: e.cause ?? 'Expense',
          categoryId: e.expenseCategoryId,
          categoryName: catNames.get(e.expenseCategoryId) ?? 'Uncategorised',
          amount: Number(e.amount) || 0,
          quantity: e.quantity ?? null,
          unitPrice: e.unitPrice ?? null,
          date: e.expenseDate,
          scanned: false,
        }));

        // Newest first — the ledger reads like a statement.
        mapped.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        this.rows.set(mapped);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  /* ---------------------------------------------------------------- actions */

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

  goToPage(next: number): void {
    const clamped = Math.min(Math.max(1, next), this.pageCount());
    this.page.set(clamped);
  }

  save(): void {
    if (!this.canSave()) return;

    this.saving.set(true);

    const payload = {
      cause: this.title.trim(),
      amount: this.computedAmount(),
      quantity: this.quantity ?? 1,
      unitPrice: this.unitPrice ?? this.computedAmount(),
      expenseDate: isoDate(this.date),
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
        // Surfaced inline rather than as a toast so it cannot be missed.
        this.saveError.set(true);
      },
    });
  }

  readonly saveError = signal(false);

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
}
