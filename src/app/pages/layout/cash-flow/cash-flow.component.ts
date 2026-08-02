import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Income } from '../../../../models/Income';
import { ExpenseCategoryGroup } from '../../../../models/ExpenseCategoryGroup';
import { IncomeService } from '../../../services/income.service';
import { DashboardService } from '../../../services/dashboard.service';
import {
  SankeyComponent,
  SankeyExpense,
} from '../../reusables/sankey/sankey.component';

@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, SankeyComponent],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.css',
})
export class CashFlowComponent implements OnInit {
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  years: number[] = [];
  incomeAmount: number | null = null;
  incomeNote = '';
  monthlyIncome = 0;
  monthlyExpenses = 0;
  expenses: SankeyExpense[] = [];
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private incomeService: IncomeService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
    this.loadMonth();
  }

  loadMonth(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    forkJoin({
      incomes: this.incomeService.getIncomesOfAMonth(
        this.selectedMonth,
        this.selectedYear
      ),
      expenses: this.dashboardService.getExpensesOfAMonth(
        this.selectedMonth,
        this.selectedYear
      ),
    }).subscribe({
      next: ({ incomes, expenses }) => {
        this.monthlyIncome = incomes.reduce(
          (total, income) => total + Number(income.amount),
          0
        );
        this.expenses = (expenses as ExpenseCategoryGroup[]).map((group) => ({
          categoryName: group.categoryName,
          totalAmount: Number(group.totalAmount),
        }));
        this.monthlyExpenses = this.expenses.reduce(
          (total, expense) => total + expense.totalAmount,
          0
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Unable to load the selected month.';
      },
    });
  }

  saveIncome(): void {
    if (!this.incomeAmount || this.incomeAmount <= 0) {
      this.errorMessage = 'Enter an income amount greater than zero.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    const entryDate = new Date(Date.UTC(this.selectedYear, this.selectedMonth - 1, 1));
    const income: Income = {
      amount: this.incomeAmount,
      note: this.incomeNote.trim() || 'Monthly income',
      entryDate: entryDate.toISOString(),
      incomeCategoryId: null,
    };

    this.incomeService.create(income).subscribe({
      next: () => {
        this.incomeAmount = null;
        this.incomeNote = '';
        this.saving = false;
        this.successMessage = 'Income added to the selected month.';
        this.loadMonth();
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Unable to save income.';
      },
    });
  }

  get remainingBalance(): number {
    return this.monthlyIncome - this.monthlyExpenses;
  }

  get monthLabel(): string {
    return new Date(this.selectedYear, this.selectedMonth - 1, 1).toLocaleDateString(
      undefined,
      { month: 'long', year: 'numeric' }
    );
  }
}
