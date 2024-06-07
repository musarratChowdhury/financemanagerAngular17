export class Expense {
  constructor(
    public Cause: string,
    private Amount: number,
    private Quantity: number | null,
    private UnitPrice: number | null,
    private ExpenseDate: Date,
    private ExpenseCategoryId: number
  ) {}
}
