import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePickerModule } from '@syncfusion/ej2-angular-calendars';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { TextBoxModule } from '@syncfusion/ej2-angular-inputs';
import {
  DropDownListComponent,
  DropDownListModule,
} from '@syncfusion/ej2-angular-dropdowns';
import { ExpenseService } from '../../../services/expense.service';
import { ExpenseCategoryService } from '../../../services/expense-category.service';
import { ExpenseCategory } from '../../../../models/ExpenseCategory';

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePickerModule,
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
    expenseAmount: ['', Validators.min(0)],
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
      this.expenseService.create(this.expenseForm.value).subscribe({
        next: (data) => console.log(data),
        error: (err) => console.log(err),
      });
    }
  }

  checkValidity() {
    return this.expenseForm.status == 'VALID' ? true : false;
  }
}
