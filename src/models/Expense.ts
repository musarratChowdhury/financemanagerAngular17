export class Expense {
  constructor(
    private Cause: string,
    private Amount: number,
    private EntryDate: Date,
    private ExpenseCategoryId: number
  ) {}
}
