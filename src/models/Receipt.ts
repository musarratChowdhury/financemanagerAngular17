import { Expense } from './Expense';

export class Receipt {
  /**
   *
   */
  constructor(
    public Id: number,
    public GrandTotal: number,
    public TotalItems: number,
    public ExpenseDate: Date,
    public EntryDate: Date,
    public CreatedBy: string,

    public Expenses: Expense[]
  ) {}
}
