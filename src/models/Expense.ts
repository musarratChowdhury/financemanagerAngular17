export class Expense {
  public id: number;
  public clientId: string;

  constructor(
    public Cause: string,
    public Amount: number,
    public Quantity: number | null,
    public UnitPrice: number | null,
    public ExpenseDate: Date,
    public ExpenseCategoryId: number
  ) {
    this.id = 0;
    this.clientId = crypto.randomUUID();
  }
}
