import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BudgetService } from '../../../services/budget.service';
import { MONTH_NAMES, MonthSnapshot, SavingsInsight } from '../../../../models/Budget';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { money, moneyNegative, percent } from '../../../_helpers/money';

const GOAL_KEY = 'syp.savingsGoal';

/**
 * Current needs — the savings-focused view.
 *
 * Answers one question: of everything you spend on, what is genuinely needed,
 * what is leaking, and how much of this month actually made it into savings?
 *
 * The savings goal is a per-device preference (localStorage) because the API
 * has no settings endpoint; everything else is derived from real expenses.
 */
@Component({
  selector: 'app-current-needs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MobileBarComponent],
  templateUrl: './current-needs.component.html',
  styleUrl: './current-needs.component.css',
})
export class CurrentNeedsComponent implements OnInit {
  readonly money = money;
  readonly moneyNegative = moneyNegative;
  readonly percent = percent;

  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly monthNames = MONTH_NAMES;

  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());
  readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 5 + i);

  readonly snapshot = signal<MonthSnapshot | null>(null);
  readonly insights = signal<SavingsInsight[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  /* ---------------------------------------------------------- savings goal */

  readonly goal = signal(0);
  goalDraft: number | null = null;
  readonly editingGoal = signal(false);

  /* ------------------------------------------------------------- computed */

  readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.selectedMonth() - 1]} ${this.selectedYear()}`
  );

  /** What is actually left over — negative means nothing was saved. */
  readonly saved = computed(() => {
    const snap = this.snapshot();
    if (!snap) return 0;
    return snap.income - snap.expenses;
  });

  readonly hasIncome = computed(() => (this.snapshot()?.income ?? 0) > 0);

  /** Share of the goal reached, capped at 100 for the bar but not the label. */
  readonly goalProgress = computed(() => {
    const target = this.goal();
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, (this.saved() / target) * 100));
  });

  readonly goalRemaining = computed(() => Math.max(0, this.goal() - this.saved()));

  readonly goalReached = computed(
    () => this.goal() > 0 && this.saved() >= this.goal()
  );

  /** Total money the insight rules say is recoverable. */
  readonly potentialSaving = computed(() =>
    this.insights().reduce((sum, i) => sum + (i.saving ?? 0), 0)
  );

  /** Highest-spend category, shown as the "needs vs wants" anchor. */
  readonly topCategory = computed(() => this.snapshot()?.topCategory ?? null);

  /** Categories ranked by spend — the needs list. */
  readonly needs = computed(() => this.snapshot()?.categories ?? []);

  /** Insight count that is worth acting on right now. */
  readonly alertCount = computed(
    () => this.insights().filter((i) => i.severity !== 'low').length
  );

  constructor(private budgetService: BudgetService) {}

  ngOnInit(): void {
    this.goal.set(this.readGoal());
    this.goalDraft = this.goal() || null;
    this.loadMonth();
  }

  private readGoal(): number {
    try {
      const raw = localStorage.getItem(GOAL_KEY);
      const value = raw ? Number(raw) : 0;
      return isFinite(value) && value > 0 ? value : 0;
    } catch {
      // Private mode / storage disabled — the page still works, just unset.
      return 0;
    }
  }

  loadMonth(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.budgetService
      .loadMonth(this.selectedMonth(), this.selectedYear())
      .subscribe({
        next: (snapshot) => {
          this.snapshot.set(snapshot);
          this.insights.set(this.budgetService.buildInsights(snapshot));
          this.loading.set(false);
        },
        error: () => {
          this.snapshot.set(null);
          this.insights.set([]);
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

  /* ------------------------------------------------------------ goal edits */

  startEditGoal(): void {
    this.goalDraft = this.goal() || null;
    this.editingGoal.set(true);
  }

  cancelEditGoal(): void {
    this.editingGoal.set(false);
  }

  saveGoal(): void {
    const value = this.goalDraft ?? 0;
    const clean = isFinite(value) && value > 0 ? value : 0;

    this.goal.set(clean);
    this.editingGoal.set(false);

    try {
      if (clean > 0) localStorage.setItem(GOAL_KEY, String(clean));
      else localStorage.removeItem(GOAL_KEY);
    } catch {
      // Nothing to do — the goal is a convenience, not data we can lose.
    }
  }

  /** Severity marker shown next to each insight. */
  marker(insight: SavingsInsight): string {
    if (insight.severity === 'high') return '!';
    if (insight.severity === 'medium') return '~';
    return '·';
  }
}
