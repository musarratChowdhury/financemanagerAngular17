export interface EnvelopeBudget {
  categoryId: number;
  categoryName: string;
  month: number;
  year: number;
  limitAmount: number;
  spentAmount: number;
}

export type EnvelopeStatus = 'empty' | 'safe' | 'warning' | 'over';
