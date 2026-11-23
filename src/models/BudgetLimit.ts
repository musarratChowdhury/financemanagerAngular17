/**
 * Category ceilings for the Budgets screen.
 *
 * One limit per (user, category) that carries forward into every month; the spend it
 * is compared against is always the month selected on screen, so spending resets on
 * the 1st but the limit does not.
 */
export type BudgetCategoryStatus = 'over' | 'near' | 'onTrack' | 'noBudget';

export interface BudgetCategory {
  categoryId: number;
  categoryName: string;
  /** 0 when the category has no ceiling. */
  limit: number;
  spent: number;
  usedPercent: number;
  status: BudgetCategoryStatus;
  /** Null for a category without a ceiling. */
  effectiveFrom: string | null;
}

export interface BudgetMonth {
  month: number;
  year: number;
  totalLimit: number;
  totalSpent: number;
  /** Linear run-rate projection for the whole month. */
  projected: number;
  usedPercent: number;
  safeToSpendPerDay: number;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  categories: BudgetCategory[];
}

/** The saved ceiling a POST /api/Budget returns. */
export interface BudgetLimit {
  id: number;
  categoryId: number;
  categoryName: string;
  monthlyLimit: number;
  effectiveFrom: string;
}
