import { ExpenseCategoryGroup } from './ExpenseCategoryGroup';
import { MonthlyExpense } from './BarChartData';

export { MonthlyExpense } from './BarChartData';
export type { ExpenseCategoryGroup } from './ExpenseCategoryGroup';

/** A category total enriched with presentation info (colour, share of spend). */
export interface CategoryTotal extends ExpenseCategoryGroup {
  color: string;
  percent: number;
}

/** A single expense row as rendered by the dashboard and expense tables. */
export interface ExpenseRow {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  date: Date | string;
  /** True when the row was captured by the receipt scanner rather than typed. */
  scanned: boolean;
}

/** Everything the dashboard / cash flow screens need for one month. */
export interface MonthSnapshot {
  month: number;
  year: number;
  monthName: string;
  income: number;
  expenses: number;
  /** income - expenses. Negative means the month is unfunded. */
  balance: number;
  categories: CategoryTotal[];
  topCategory: CategoryTotal | null;
  /** Twelve entries for the selected year, in calendar order. */
  months: MonthlyExpense[];
  /** The single highest-spend month of the year, if any spend exists. */
  peakMonth: MonthlyExpense | null;
  recentExpenses: ExpenseRow[];
}

/**
 * A detected opportunity to save money. "Save Your Penny" is savings-first, so
 * every screen can surface these rather than only reporting what was spent.
 */
export interface SavingsInsight {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  /** Estimated monthly saving in currency units, when quantifiable. */
  saving: number | null;
}

/** Palette lifted from the design so categories stay visually stable. */
export const CATEGORY_COLORS: string[] = [
  '#111111',
  '#A6CF1D',
  '#2F6FED',
  '#E5539B',
  '#8E6CD1',
  '#F59E0B',
  '#14B8A6',
  '#8A8A83',
  '#0EA5E9',
  '#D4A017',
  '#E8590C',
  '#0CA678',
];

export const MONTH_NAMES: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_SHORT: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
