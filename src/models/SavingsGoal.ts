/**
 * Savings goals.
 *
 * "Saved so far" is never stored on the goal: it is the sum of its contributions, so
 * the average-per-month and the pace verdict come from real history.
 */
export type GoalPace = 'reached' | 'noSavings' | 'noTarget' | 'onTrack' | 'late';

export interface GoalContribution {
  id: number;
  amount: number;
  contributionDate: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string | null;
  createdAt: string;
  avgSavedPerMonth: number;
  /** Null when no reach-by date is set. */
  neededPerMonth: number | null;
  monthsRemaining: number | null;
  paceStatus: GoalPace;
  projectedReachDate: string | null;
  contributions: GoalContribution[];
}

export interface CreateGoalRequest {
  name: string;
  targetAmount: number;
  targetDate?: string | null;
  initialSaved?: number | null;
}

export interface UpdateGoalRequest {
  name: string;
  targetAmount: number;
  targetDate?: string | null;
}

export interface AddContributionRequest {
  amount: number;
  contributionDate?: string | null;
}
