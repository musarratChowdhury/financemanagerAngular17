export class Expense {
  private static nextId = 1;
  public id: number;

  constructor(
    public Cause: string,
    public Amount: number,
    public Quantity: number | null,
    public UnitPrice: number | null,
    public ExpenseDate: Date,
    public ExpenseCategoryId: number
  ) {
    this.id = Expense.nextId++;
  }
}
