export interface Income {
  id?: number;
  note: string;
  amount: number;
  entryDate: string;
  incomeCategoryId?: number | null;
}
