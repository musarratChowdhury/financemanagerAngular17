export class MonthlyExpense {
  constructor(
    public year: number,
    public month: number,
    public monthName: string,
    public totalExpense: number
  ) {}
}
