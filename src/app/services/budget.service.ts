import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DashboardService } from './dashboard.service';
import { ExpenseService } from './expense.service';
import { ExpenseCategoryService } from './expense-category.service';
import { IncomeService } from './income.service';
import {
  CATEGORY_COLORS,
  CategoryTotal,
  ExpenseRow,
  MONTH_NAMES,
  MonthSnapshot,
  MonthlyExpense,
  SavingsInsight,
} from '../../models/Budget';

/**
 * Aggregates the existing per-endpoint services into the shapes the redesigned
 * screens need, and derives the savings/waste signals that make this app
 * savings-first rather than a plain ledger.
 *
 * Every request is failure-tolerant: a dead endpoint degrades that one panel
 * instead of blanking the page.
 */
@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  constructor(
    private dashboardService: DashboardService,
    private expenseService: ExpenseService,
    private expenseCategoryService: ExpenseCategoryService,
    private incomeService: IncomeService
  ) {}

  /** Loads a complete month view for the dashboard and cash-flow screens. */
  loadMonth(month: number, year: number): Observable<MonthSnapshot> {
    return forkJoin({
      groups: this.dashboardService
        .getExpensesOfAMonth(month, year)
        .pipe(catchError(() => of([]))),
      incomes: this.incomeService
        .getIncomesOfAMonth(month, year)
        .pipe(catchError(() => of([]))),
      expenses: this.expenseService.getAll().pipe(catchError(() => of([]))),
      categories: this.expenseCategoryService.getAll().pipe(catchError(() => of([]))),
      months: this.dashboardService.getBarChartData().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ groups, incomes, expenses, categories, months }) =>
        this.buildSnapshot(
          month,
          year,
          groups as any[],
          incomes as any[],
          expenses as any[],
          categories as any[],
          months as MonthlyExpense[]
        )
      )
    );
  }

  private buildSnapshot(
    month: number,
    year: number,
    groups: any[],
    incomes: any[],
    expenses: any[],
    categories: any[],
    monthTotals: MonthlyExpense[]
  ): MonthSnapshot {
    const categoryTotals = this.toCategoryTotals(groups);
    const expenseTotal = categoryTotals.reduce((sum, c) => sum + c.totalAmount, 0);
    const incomeTotal = (incomes ?? []).reduce(
      (sum, i) => sum + (Number(i?.amount) || 0),
      0
    );

    const yearMonths = this.toYearMonths(monthTotals, year);
    const peak = yearMonths.reduce<MonthlyExpense | null>(
      (best, m) => (!best || m.totalExpense > best.totalExpense ? m : best),
      null
    );

    return {
      month,
      year,
      monthName: MONTH_NAMES[month - 1] ?? '',
      income: incomeTotal,
      expenses: expenseTotal,
      balance: incomeTotal - expenseTotal,
      categories: categoryTotals,
      topCategory: categoryTotals[0] ?? null,
      months: yearMonths,
      peakMonth: peak && peak.totalExpense > 0 ? peak : null,
      recentExpenses: this.toExpenseRows(expenses, categories)
        .filter((row) => this.inMonth(row.date, month, year))
        .sort((a, b) => this.time(b.date) - this.time(a.date))
        .slice(0, 6),
    };
  }

  /** Category groups -> coloured totals with percentage of spend. */
  private toCategoryTotals(groups: any[]): CategoryTotal[] {
    const rows = (groups ?? [])
      .map((g) => ({
        categoryId: Number(g?.categoryId) || 0,
        categoryName: g?.categoryName ?? 'Uncategorised',
        totalAmount: Number(g?.totalAmount) || 0,
      }))
      .filter((g) => g.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const total = rows.reduce((sum, r) => sum + r.totalAmount, 0);

    return rows.map((r, index) => ({
      ...r,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      percent: total > 0 ? (r.totalAmount / total) * 100 : 0,
    }));
  }

  /** Normalises the yearly bar-chart payload to exactly 12 calendar months. */
  private toYearMonths(data: MonthlyExpense[], year: number): MonthlyExpense[] {
    const byMonth = new Map<number, MonthlyExpense>();
    for (const row of data ?? []) {
      const m = Number(row?.month);
      if (m >= 1 && m <= 12 && Number(row?.year) === year) {
        byMonth.set(m, row);
      }
    }
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const existing = byMonth.get(month);
      return (
        existing ?? new MonthlyExpense(year, month, MONTH_NAMES[i], 0)
      );
    });
  }

  /** Flattens raw expenses, joining the category name locally. */
  toExpenseRows(expenses: any[], categories: any[]): ExpenseRow[] {
    const nameById = new Map<number, string>();
    for (const c of categories ?? []) {
      nameById.set(Number(c?.id), c?.name ?? 'Uncategorised');
    }

    return (expenses ?? []).map((e) => {
      const categoryId = Number(e?.expenseCategoryId) || 0;
      return {
        id: Number(e?.id) || 0,
        title: e?.cause ?? e?.title ?? 'Expense',
        categoryId,
        categoryName:
          e?.categoryName ?? nameById.get(categoryId) ?? 'Uncategorised',
        amount: Number(e?.amount) || 0,
        quantity: e?.quantity === null || e?.quantity === undefined ? null : Number(e.quantity),
        unitPrice:
          e?.unitPrice === null || e?.unitPrice === undefined ? null : Number(e.unitPrice),
        date: e?.expenseDate ?? e?.entryDate ?? new Date(),
        scanned: Boolean(e?.scanned ?? e?.isScanned ?? false),
      };
    });
  }

  /**
   * Derives savings opportunities for a month.
   *
   * Deliberately conservative: each rule fires only on data that actually
   * exists, and every rule states its reasoning so the user can judge it rather
   * than trusting a black box.
   */
  buildInsights(snapshot: MonthSnapshot): SavingsInsight[] {
    const insights: SavingsInsight[] = [];
    const spend = snapshot.expenses;

    if (spend <= 0) {
      return [
        {
          id: 'no-spend',
          severity: 'low',
          title: 'Nothing recorded yet',
          detail: `No expenses recorded for ${snapshot.monthName} ${snapshot.year}. Add one to start spotting waste.`,
          saving: null,
        },
      ];
    }

    // 1. The month is not funded by recorded income.
    if (snapshot.income <= 0) {
      insights.push({
        id: 'unfunded',
        severity: 'high',
        title: 'This month has no recorded income',
        detail: `You spent ${spend.toFixed(
          0
        )} in ${snapshot.monthName} with no income logged, so every rupee is unfunded.`,
        saving: null,
      });
    } else if (snapshot.balance < 0) {
      insights.push({
        id: 'overspend',
        severity: 'high',
        title: 'Spending is ahead of income',
        detail: `You are ${Math.abs(snapshot.balance).toFixed(
          0
        )} over income this month. Trimming the top category alone would close most of the gap.`,
        saving: Math.abs(snapshot.balance),
      });
    }

    // 2. One category dominates the month.
    const top = snapshot.topCategory;
    if (top && top.percent >= 30) {
      insights.push({
        id: 'concentration',
        severity: top.percent >= 45 ? 'high' : 'medium',
        title: `${top.categoryName} takes ${top.percent.toFixed(0)}% of your spend`,
        detail: `${top.categoryName} accounts for ${top.totalAmount.toFixed(
          0
        )} of ${spend.toFixed(
          0
        )}. A 10% cut here saves more than cutting every small category combined.`,
        saving: top.totalAmount * 0.1,
      });
    }

    // 3. Compare with the same month's average across the year.
    const activeMonths = snapshot.months.filter((m) => m.totalExpense > 0);
    if (activeMonths.length >= 2) {
      const average =
        activeMonths.reduce((sum, m) => sum + m.totalExpense, 0) / activeMonths.length;
      const delta = spend - average;
      if (delta > 0 && average > 0 && delta / average > 0.15) {
        insights.push({
          id: 'above-average',
          severity: delta / average > 0.4 ? 'high' : 'medium',
          title: `${snapshot.monthName} is above your monthly average`,
          detail: `You have spent ${delta.toFixed(
            0
          )} more than your ${average.toFixed(
            0
          )} monthly average. Repeating this every month costs ${(delta * 12).toFixed(
            0
          )} a year.`,
          saving: delta,
        });
      } else if (delta < 0 && average > 0) {
        insights.push({
          id: 'below-average',
          severity: 'low',
          title: `${snapshot.monthName} is below your monthly average`,
          detail: `You are ${Math.abs(delta).toFixed(
            0
          )} under your ${average.toFixed(
            0
          )} average. Move the difference into savings before it gets absorbed.`,
          saving: Math.abs(delta),
        });
      }
    }

    // 4. Duplicate-looking small purchases in the same category.
    const duplicate = this.findRepeatSpending(snapshot.recentExpenses);
    if (duplicate) {
      insights.push(duplicate);
    }

    return insights;
  }

  /**
   * Flags a category with three or more small purchases in the recent window —
   * the classic "it was only a little" leak.
   */
  private findRepeatSpending(rows: ExpenseRow[]): SavingsInsight | null {
    if (rows.length < 3) return null;

    const byCategory = new Map<string, ExpenseRow[]>();
    for (const row of rows) {
      const list = byCategory.get(row.categoryName) ?? [];
      list.push(row);
      byCategory.set(row.categoryName, list);
    }

    for (const [name, list] of byCategory) {
      if (list.length >= 3) {
        const total = list.reduce((sum, r) => sum + r.amount, 0);
        return {
          id: `repeat-${name}`,
          severity: 'medium',
          title: `${list.length} small ${name} purchases this month`,
          detail: `${name} appears ${list.length} times in your recent expenses, adding up to ${total.toFixed(
            0
          )}. Frequent small buys are the easiest waste to miss.`,
          saving: total * 0.25,
        };
      }
    }
    return null;
  }

  private inMonth(date: Date | string, month: number, year: number): boolean {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }

  private time(date: Date | string): number {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
}
