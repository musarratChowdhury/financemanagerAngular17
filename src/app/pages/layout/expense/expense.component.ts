import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DateTimePickerModule } from '@syncfusion/ej2-angular-calendars';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { TextBoxModule } from '@syncfusion/ej2-angular-inputs';
import {
  DropDownListComponent,
  DropDownListModule,
} from '@syncfusion/ej2-angular-dropdowns';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { ExpenseCategory } from '../../../../models/ExpenseCategory';
import { Expense } from '../../../../models/Expense';

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DateTimePickerModule,
    NumericTextBoxModule,
    TextBoxModule,
    DropDownListModule,
  ],
  templateUrl: './expense.component.html',
  styleUrl: './expense.component.css',
})
export class ExpenseComponent implements OnInit {
  public expenseCategoryList: ExpenseCategory[] = [];
  constructor(
    private formBuilder: FormBuilder,
    private expenseService: ExpenseService,
    private expenseCategoryService: ExpenseCategoryService
  ) {}

  ngOnInit(): void {
    this.expenseCategoryService.getAll().subscribe({
      next: (data) => {
        this.expenseCategoryList = data;
      },
      error: (err) => console.log(err),
    });
  }

  expenseForm = this.formBuilder.group({
    expenseName: ['', Validators.required],
    expenseAmount: ['', Validators.min(1)],
    expenseQuantity: ['', Validators.min(0)],
    expenseUnitPrice: ['', Validators.min(0)],
    expenseDate: ['', Validators.required],
    expenseCategory: ['', Validators.required],
  });

  // maps the appropriate column to fields property
  public fields: Object = { text: 'name', value: 'id' };
  // set the height of the popup element
  public height: string = '220px';
  // set the placeholder to DropDownList input element
  public waterMark: string = 'Select an Expense Category';
  // set the value to select an item based on mapped value at initial rendering
  public value: string = 'Game3';
  public onChange(args: any): void {}

  onSubmit() {
    console.log(this.expenseForm.value);
    if (this.checkValidity()) {
      const expenseName = this.expenseForm.get('expenseName')?.value;
      const expenseAmount = parseInt(
        this.expenseForm.get('expenseAmount')?.value!
      );
      const expenseQuantity = parseInt(
        this.expenseForm.get('expenseQuantity')?.value!
      );
      const expenseUnitPrice = parseInt(
        this.expenseForm.get('expenseUnitPrice')?.value!
      );
      const expenseDate = new Date(this.expenseForm.get('expenseDate')?.value!);
      const expenseCategory = parseInt(
        this.expenseForm.get('expenseCategory')?.value!
      );

      let newExpense = new Expense(
        expenseName!,
        expenseAmount,
        expenseQuantity,
        expenseUnitPrice,
        expenseDate,
        expenseCategory
      );
      this.expenseService.create(newExpense).subscribe({
        next: (data) => console.log(data),
        error: (err) => console.log(err),
      });
    }
  }

  checkValidity() {
    return this.expenseForm.status == 'VALID' ? true : false;
  }
}
