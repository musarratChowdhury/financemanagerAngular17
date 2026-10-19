import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Income } from '../../../../models/Income';
import { IncomeService } from '../../../services/income.service';
import { BudgetService } from '../../../services/budget.service';
import { MONTH_NAMES, MonthSnapshot } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import {
  SankeyComponent,
  SankeyExpense,
} from '../../reusables/sankey/sankey.component';
import { money, moneyNegative } from '../../../_helpers/money';

/**
 * Cash flow — where the month's money comes from and where it goes.
 *
 * Mobile-first: period selectors, three stacked KPI cards, the flow bars, the
 * add-income panel, then the Sankey. From 768px the KPIs go three-up and the
 * flow/add-income pair sits side by side.
 */
@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, MobileBarComponent, SankeyComponent],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.css',
})
export class CashFlowComponent implements OnInit {
  readonly money = money;
  readonly moneyNegative = moneyNegative;

  readonly monthNames = MONTH_NAMES;
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);

  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());
  readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 5 + i);

  readonly snapshot = signal<MonthSnapshot | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  /* ------------------------------------------------------------ add income */

  incomeAmount: number | null = null;
  incomeNote = '';
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly saved = signal(false);

  /* --------------------------------------------------------------- computed */

  readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`
  );

  readonly income = computed(() => this.snapshot()?.income ?? 0);
  readonly expenses = computed(() => this.snapshot()?.expenses ?? 0);
  readonly balance = computed(() => this.income() - this.expenses());
  readonly isOver = computed(() => this.balance() < 0);

  /** Sankey input, mapped from the snapshot's category totals. */
  readonly sankeyExpenses = computed<SankeyExpense[]>(
    () =>
      this.snapshot()?.categories.map((c) => ({
        categoryName: c.categoryName,
        totalAmount: c.totalAmount,
      })) ?? []
  );

  /** Bar lengths are relative to the largest category, as in the design. */
  readonly flows = computed(() => {
    const cats = this.snapshot()?.categories ?? [];
    const largest = cats.reduce((max, c) => Math.max(max, c.totalAmount), 0);
    return cats.map((c) => ({
      ...c,
      width: largest > 0 ? Math.max(1.5, (c.totalAmount / largest) * 100) : 0,
    }));
  });

  /**
   * One sentence that explains the month's funding position, mirroring the
   * design's inline explanation under the period heading.
   */
  readonly fundingNote = computed(() => {
    const spend = this.expenses();
    if (spend <= 0) {
      return `Nothing recorded for ${this.monthLabel()} yet.`;
    }
    if (this.income() <= 0) {
      return `No income recorded for ${this.monthLabel()}, so all ${money(
        spend
      )} of spending is unfunded. Add income to see how it is covered.`;
    }
    if (this.isOver()) {
      return `Spending is ${money(
        Math.abs(this.balance())
      )} ahead of income this month.`;
    }
    return `${money(
      this.balance()
    )} of ${money(this.income())} income is left after ${money(spend)} of spending.`;
  });

  readonly topFlow = computed(() => this.flows()[0] ?? null);

  constructor(
    private incomeService: IncomeService,
    private budgetService: BudgetService
  ) {}

  ngOnInit(): void {
    this.loadMonth();
  }

  loadMonth(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.budgetService
      .loadMonth(this.selectedMonth(), this.selectedYear())
      .subscribe({
        next: (snapshot) => {
          this.snapshot.set(snapshot);
          this.loading.set(false);
        },
        error: () => {
          this.snapshot.set(null);
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  onMonth(value: string): void {
    this.selectedMonth.set(Number(value));
    this.loadMonth();
  }

  onYear(value: string): void {
    this.selectedYear.set(Number(value));
    this.loadMonth();
  }

  saveIncome(): void {
    const amount = this.incomeAmount;
    if (!amount || amount <= 0 || this.saving()) {
      this.saveError.set('Enter an amount greater than zero.');
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    this.saved.set(false);

    const income: Income = {
      amount,
      note: this.incomeNote.trim() || 'Monthly income',
      // Anchored to the first of the selected month so the API files it there.
      entryDate: new Date(
        Date.UTC(this.selectedYear(), this.selectedMonth() - 1, 1)
      ).toISOString(),
      incomeCategoryId: null,
    };

    this.incomeService.create(income).subscribe({
      next: () => {
        this.incomeAmount = null;
        this.incomeNote = '';
        this.saving.set(false);
        this.saved.set(true);
        this.loadMonth();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save the income. Please try again.');
      },
    });
  }
}
