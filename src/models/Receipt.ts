import { Expense } from './Expense';

export class Receipt {
  /**
   *
   */
  constructor(
    public Id: string | null,
    public GrandTotal: number,
    public TotalItems: number,
    public ExpenseDate: Date,
    public EntryDate: Date | null,
    public CreatedBy: string | null,

    public Expenses: Expense[]
  ) {}
}
