import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BudgetLimitService } from '../../../services/budget-limit.service';
import { GoalService } from '../../../services/goal.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { MONTH_NAMES } from '../../../../models/Budget';
import { BudgetCategory, BudgetMonth } from '../../../../models/BudgetLimit';
import { GoalContribution, SavingsGoal } from '../../../../models/SavingsGoal';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import {
  CURRENCY_SYMBOL,
  isoDate,
  isoUtcDate,
  longDate,
  money,
  percent,
} from '../../../_helpers/money';

interface CategoryOption {
  id: number;
  name: string;
}

/**
 * Budgets & goals.
 *
 * Two shapes of planning live on one screen because they answer the same question:
 * a ceiling per category for the month (spending resets monthly, the ceiling carries
 * forward), and savings goals whose progress is a real contribution ledger.
 *
 * All the month maths — projection, safe-to-spend per day, category status — comes
 * from the server so this screen never disagrees with another consumer of the same
 * numbers.
 */
@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, FormsModule, MobileBarComponent],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.css',
})
export class BudgetsComponent implements OnInit {
  readonly money = money;
  readonly percent = percent;
  readonly longDate = longDate;
  readonly currencySymbol = CURRENCY_SYMBOL;

  readonly monthNames = MONTH_NAMES;
  readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - 5 + index);

  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly summary = signal<BudgetMonth | null>(null);
  readonly goals = signal<SavingsGoal[]>([]);
  readonly categories = signal<CategoryOption[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly notice = signal('');

  /* ------------------------------------------------------------ budget form */

  readonly showBudgetForm = signal(false);
  readonly savingBudget = signal(false);
  readonly budgetError = signal('');

  budgetDraft: { categoryId: number | null; limit: number | null } = {
    categoryId: null,
    limit: null,
  };

  /* -------------------------------------------------------------- goal form */

  readonly showGoalForm = signal(false);
  readonly savingGoal = signal(false);
  readonly goalError = signal('');

  goalDraft: { name: string; target: number | null; saved: number | null; reachBy: string } = {
    name: '',
    target: null,
    saved: null,
    reachBy: '',
  };

  /* --------------------------------------------------------- contributions */

  readonly addingTo = signal<number | null>(null);
  readonly savingContribution = signal(false);
  readonly contributionError = signal('');
  readonly openGoals = signal<number[]>([]);

  contributionDraft: { amount: number | null; date: string } = { amount: null, date: '' };

  /* --------------------------------------------------------------- computed */

  readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`
  );

  readonly daysLeftLabel = computed(() => {
    const snapshot = this.summary();
    if (!snapshot) return '';
    if (snapshot.daysElapsed === 0) return 'not started yet';
    if (snapshot.daysRemaining === 0) return 'month closed';
    return `${snapshot.daysRemaining} day${snapshot.daysRemaining === 1 ? '' : 's'} left`;
  });

  /** Spend so far as a share of the ceiling, capped for the bar but not the label. */
  readonly spentBar = computed(() => this.capPercent(this.summary()?.usedPercent ?? 0));

  /** Width of the forecast band: from spend so far out to the projection. */
  readonly forecastBar = computed(() => {
    const snapshot = this.summary();
    if (!snapshot || snapshot.totalLimit <= 0) return 0;
    const projected = this.capPercent((snapshot.projected / snapshot.totalLimit) * 100);
    return Math.max(0, projected - this.spentBar());
  });

  readonly hasBudgets = computed(() => (this.summary()?.totalLimit ?? 0) > 0);

  constructor(
    private budgetService: BudgetLimitService,
    private goalService: GoalService,
    private expenseCategoryService: ExpenseCategoryService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  /* ------------------------------------------------------------------ data */

  loadAll(): void {
    this.loading.set(true);
    this.failed.set(false);

    forkJoin({
      summary: this.budgetService
        .getSummary(this.selectedMonth(), this.selectedYear())
        .pipe(catchError(() => of(null))),
      goals: this.goalService.getAll().pipe(catchError(() => of([]))),
      categories: this.expenseCategoryService.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ summary, goals, categories }) => {
        // An unexpected payload must not reach the template: `s.categories.length`
        // would throw and blank the whole screen.
        const valid = this.isMonthSummary(summary) ? summary : null;
        this.summary.set(valid);
        this.goals.set((goals ?? []).map((goal) => this.normalizeGoal(goal)));
        this.categories.set(
          (categories ?? []).map((category: any) => ({
            id: Number(category?.id),
            name: String(category?.name ?? 'Uncategorised'),
          }))
        );
        this.failed.set(valid === null);
        this.loading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.goals.set([]);
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  loadSummary(): void {
    this.budgetService.getSummary(this.selectedMonth(), this.selectedYear()).subscribe({
      next: (snapshot) => {
        const valid = this.isMonthSummary(snapshot) ? snapshot : null;
        this.summary.set(valid);
        this.failed.set(valid === null);
      },
      error: () => this.failed.set(true),
    });
  }

  onMonth(value: number | string): void {
    this.selectedMonth.set(Number(value));
    this.loadSummary();
  }

  onYear(value: number | string): void {
    this.selectedYear.set(Number(value));
    this.loadSummary();
  }

  /* ---------------------------------------------------------------- budget */

  limitFor(categoryId: number): number {
    return (
      this.summary()?.categories.find((category) => category.categoryId === categoryId)?.limit ?? 0
    );
  }

  categoryOptionLabel(category: CategoryOption): string {
    const limit = this.limitFor(category.id);
    return limit > 0 ? `${category.name} · ${money(limit)}` : category.name;
  }

  openBudgetForm(category?: BudgetCategory): void {
    this.budgetError.set('');
    this.notice.set('');
    this.budgetDraft = {
      categoryId: category && category.categoryId > 0 ? category.categoryId : null,
      limit: category && category.limit > 0 ? category.limit : null,
    };
    this.showBudgetForm.set(true);
  }

  cancelBudgetForm(): void {
    this.showBudgetForm.set(false);
    this.budgetError.set('');
  }

  saveBudget(): void {
    const categoryId = this.budgetDraft.categoryId;
    const limit = Number(this.budgetDraft.limit);

    if (!categoryId) {
      this.budgetError.set('Choose a category first.');
      return;
    }

    if (!isFinite(limit) || limit <= 0) {
      this.budgetError.set('Enter a monthly limit greater than zero.');
      return;
    }

    this.savingBudget.set(true);
    this.budgetError.set('');

    this.budgetService.save(categoryId, limit).subscribe({
      next: () => {
        this.savingBudget.set(false);
        this.showBudgetForm.set(false);
        this.notice.set('Budget saved.');
        this.loadSummary();
      },
      error: () => {
        this.savingBudget.set(false);
        this.budgetError.set('Could not save this budget. Please try again.');
      },
    });
  }

  removeBudget(category: BudgetCategory): void {
    if (!window.confirm(`Remove the ${money(category.limit)} budget for "${category.categoryName}"?`)) {
      return;
    }

    this.notice.set('');
    this.budgetService.remove(category.categoryId).subscribe({
      next: () => {
        this.notice.set('Budget removed.');
        this.loadSummary();
      },
      error: () => this.budgetError.set('Could not remove this budget. Please try again.'),
    });
  }

  /* ------------------------------------------------------------------ goals */

  openGoalForm(): void {
    this.goalError.set('');
    this.notice.set('');
    this.goalDraft = { name: '', target: null, saved: null, reachBy: '' };
    this.showGoalForm.set(true);
  }

  cancelGoalForm(): void {
    this.showGoalForm.set(false);
    this.goalError.set('');
  }

  saveGoal(): void {
    const name = (this.goalDraft.name ?? '').trim();
    const target = Number(this.goalDraft.target);
    const saved = this.goalDraft.saved === null ? 0 : Number(this.goalDraft.saved);

    if (!name) {
      this.goalError.set('Say what you are saving for.');
      return;
    }

    if (!isFinite(target) || target <= 0) {
      this.goalError.set('Enter a target greater than zero.');
      return;
    }

    if (saved < 0) {
      this.goalError.set('Amount already saved cannot be negative.');
      return;
    }

    this.savingGoal.set(true);
    this.goalError.set('');

    this.goalService
      .create({
        name,
        targetAmount: target,
        targetDate: this.goalDraft.reachBy ? isoUtcDate(this.goalDraft.reachBy) : null,
        initialSaved: saved > 0 ? saved : null,
      })
      .subscribe({
        next: (goal) => {
          this.savingGoal.set(false);
          this.showGoalForm.set(false);
          this.notice.set('Goal created.');
          this.goals.update((list) => [...list, goal]);
        },
        error: () => {
          this.savingGoal.set(false);
          this.goalError.set('Could not create this goal. Please try again.');
        },
      });
  }

  deleteGoal(goal: SavingsGoal): void {
    if (!window.confirm(`Delete the goal "${goal.name}" and its contribution history?`)) {
      return;
    }

    this.goalService.delete(goal.id).subscribe({
      next: () => {
        this.notice.set('Goal deleted.');
        this.goals.update((list) => list.filter((item) => item.id !== goal.id));
      },
      error: () => this.goalError.set('Could not delete this goal. Please try again.'),
    });
  }

  goalBar(goal: SavingsGoal): number {
    if (goal.targetAmount <= 0) return 0;
    return this.capPercent((goal.savedAmount / goal.targetAmount) * 100);
  }

  goalFillClass(goal: SavingsGoal): Record<string, boolean> {
    return {
      'is-complete': goal.paceStatus === 'reached',
      'is-late': goal.paceStatus === 'late',
      'is-idle': goal.paceStatus === 'noSavings',
    };
  }

  paceLabel(goal: SavingsGoal): string {
    switch (goal.paceStatus) {
      case 'reached':
        return 'Target reached';
      case 'noSavings':
        return 'No savings yet';
      case 'noTarget':
        return 'No reach-by date';
      case 'onTrack':
        return 'On track';
      default:
        return 'Behind pace';
    }
  }

  paceClass(goal: SavingsGoal): Record<string, boolean> {
    return {
      'is-good': goal.paceStatus === 'onTrack' || goal.paceStatus === 'reached',
      'is-bad': goal.paceStatus === 'late',
      'is-idle': goal.paceStatus === 'noSavings' || goal.paceStatus === 'noTarget',
    };
  }

  targetLabel(goal: SavingsGoal): string {
    return goal.targetDate ? `Target ${this.monthYear(goal.targetDate)}` : 'No target date';
  }

  /* ---------------------------------------------------------- contributions */

  openContribution(goal: SavingsGoal): void {
    this.contributionError.set('');
    this.notice.set('');
    this.addingTo.set(goal.id);
    this.contributionDraft = { amount: null, date: isoDate(new Date()) };
  }

  cancelContribution(): void {
    this.addingTo.set(null);
    this.contributionError.set('');
  }

  saveContribution(goal: SavingsGoal): void {
    const amount = Number(this.contributionDraft.amount);

    if (!isFinite(amount) || amount <= 0) {
      this.contributionError.set('Enter an amount greater than zero.');
      return;
    }

    this.savingContribution.set(true);
    this.contributionError.set('');

    this.goalService
      .addContribution(goal.id, {
        amount,
        contributionDate: this.contributionDraft.date ? isoUtcDate(this.contributionDraft.date) : null,
      })
      .subscribe({
        next: (updated) => {
          this.savingContribution.set(false);
          this.addingTo.set(null);
          this.replaceGoal(updated);
        },
        error: () => {
          this.savingContribution.set(false);
          this.contributionError.set('Could not add this amount. Please try again.');
        },
      });
  }

  removeContribution(goal: SavingsGoal, contribution: GoalContribution): void {
    if (!window.confirm(`Remove the ${money(contribution.amount)} contribution?`)) {
      return;
    }

    this.goalService.removeContribution(goal.id, contribution.id).subscribe({
      next: () => this.reloadGoal(goal.id),
      error: () => this.contributionError.set('Could not remove this contribution.'),
    });
  }

  toggleHistory(goalId: number): void {
    this.openGoals.update((ids) =>
      ids.includes(goalId) ? ids.filter((id) => id !== goalId) : [...ids, goalId]
    );
  }

  isOpen(goalId: number): boolean {
    return this.openGoals().includes(goalId);
  }

  /* -------------------------------------------------------------- utilities */

  pillLabel(category: BudgetCategory): string {
    switch (category.status) {
      case 'over':
        return 'Over budget';
      case 'near':
        return 'Near limit';
      case 'onTrack':
        return 'On track';
      default:
        return 'No budget';
    }
  }

  pillClass(category: BudgetCategory): Record<string, boolean> {
    return {
      'syp-pill--danger': category.status === 'over',
      'syp-pill--warn': category.status === 'near',
      'syp-pill--lime': category.status === 'onTrack',
    };
  }

  /** Budget bar width, capped so an overspend still fills the track. */
  barWidth(category: BudgetCategory): number {
    return this.capPercent(category.usedPercent);
  }

  /** `Jun 2027` — the month-and-year reading used for target and "since" labels. */
  monthYear(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
  }

  percentOf(value: number | null | undefined): string {
    return percent(Number(value) || 0, 0);
  }

  private capPercent(value: number): number {
    if (!isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  /** A summary without a category array would crash the template, so it is rejected here. */
  private isMonthSummary(value: unknown): value is BudgetMonth {
    const candidate = value as BudgetMonth | null;
    return !!candidate && typeof candidate === 'object' && Array.isArray(candidate.categories);
  }

  /** Guarantees the collection exists before a template reads `.length` on it. */
  private normalizeGoal(goal: SavingsGoal): SavingsGoal {
    return {
      ...goal,
      contributions: Array.isArray(goal?.contributions) ? goal.contributions : [],
    };
  }

  private replaceGoal(updated: SavingsGoal): void {
    this.goals.update((list) =>
      list.map((goal) => (goal.id === updated.id ? this.normalizeGoal(updated) : goal))
    );
  }

  /** One goal, re-read after a ledger delete so the derived figures stay honest. */
  private reloadGoal(goalId: number): void {
    this.goalService.getAll().subscribe({
      next: (goals) => {
        const list = (goals ?? []).map((goal) => this.normalizeGoal(goal));
        this.goals.set(list);
        if (!list.some((goal) => goal.id === goalId)) {
          this.openGoals.update((ids) => ids.filter((id) => id !== goalId));
        }
      },
      error: () => this.contributionError.set('Could not refresh this goal.'),
    });
  }
}
