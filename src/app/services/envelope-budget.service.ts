import { Injectable } from '@angular/core';
import { forkJoin, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DashboardService } from './dashboard.service';
import { ExpenseCategoryService } from './expense-category.service';
import { OfflineStoreService } from './offline-store.service';
import { EnvelopeBudget, EnvelopeStatus } from '../../models/EnvelopeBudget';

@Injectable({ providedIn: 'root' })
export class EnvelopeBudgetService {
  constructor(
    private dashboard: DashboardService,
    private categories: ExpenseCategoryService,
    private store: OfflineStoreService
  ) {}

  load(month: number, year: number): Observable<EnvelopeBudget[]> {
    return forkJoin({
      groups: this.dashboard.getExpensesOfAMonth(month, year),
      categories: this.categories.getAll(),
      envelopes: from(this.store.getEnvelopes(month, year)),
    }).pipe(
      map(({ groups, categories, envelopes }) => {
        const categoryNames = new Map<number, string>(
          (categories ?? []).map((category: any) => [Number(category.id), category.name])
        );
        const spent = new Map<number, number>(
          (groups ?? []).map((group: any) => [
            Number(group.categoryId),
            Number(group.totalAmount) || 0,
          ])
        );
        return (categories ?? [])
          .map((category: any) => {
            const categoryId = Number(category.id);
            const saved = envelopes.find((item) => item.categoryId === categoryId);
            return {
              categoryId,
              categoryName: categoryNames.get(categoryId) ?? 'Uncategorised',
              month,
              year,
              limitAmount: saved?.limitAmount ?? 0,
              spentAmount: spent.get(categoryId) ?? 0,
            };
          })
          .filter((item) => item.limitAmount > 0 || item.spentAmount > 0)
          .sort((a, b) => this.utilisation(b) - this.utilisation(a));
      })
    );
  }

  save(budget: EnvelopeBudget): Observable<void> {
    const limit = Number(budget.limitAmount);
    if (!Number.isFinite(limit) || limit <= 0) {
      return from(this.store.deleteEnvelope(budget.categoryId, budget.month, budget.year));
    }
    return from(this.store.saveEnvelope(
      budget.categoryId,
      budget.month,
      budget.year,
      limit
    ));
  }

  status(budget: EnvelopeBudget): EnvelopeStatus {
    if (budget.limitAmount <= 0) return 'empty';
    const ratio = budget.spentAmount / budget.limitAmount;
    return ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'safe';
  }

  utilisation(budget: EnvelopeBudget): number {
    if (budget.limitAmount <= 0) return budget.spentAmount > 0 ? 100 : 0;
    return budget.spentAmount / budget.limitAmount;
  }
}
