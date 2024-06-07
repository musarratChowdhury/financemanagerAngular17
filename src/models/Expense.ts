export class Expense {
  constructor(
    public Cause: string,
    public Amount: number,
    public Quantity: number | null,
    public UnitPrice: number | null,
    public ExpenseDate: Date,
    public ExpenseCategoryId: number
  ) {}
}
