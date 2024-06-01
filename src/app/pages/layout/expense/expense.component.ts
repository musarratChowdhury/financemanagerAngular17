import {Component} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import { DatePickerModule } from '@syncfusion/ej2-angular-calendars';
import { NumericTextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { TextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { DropDownListComponent, DropDownListModule } from '@syncfusion/ej2-angular-dropdowns';

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePickerModule,
    NumericTextBoxModule,
    TextBoxModule,
    DropDownListModule
  ],
  templateUrl: './expense.component.html',
  styleUrl: './expense.component.css'
})
export class ExpenseComponent {
  constructor(private formBuilder: FormBuilder) {
  }

  expenseForm = this.formBuilder.group({
    expenseName: ['', Validators.required],
    expenseAmount: ['', Validators.min(0)],
    expenseDate: ['', Validators.required],
    expenseCategory: ['', Validators.required],
  });

  // define the JSON of data
  public categoryData: Object[] = [
    { Id: '1', CategoryName: 'Shopping' },
    { Id: '2', CategoryName: 'Education' },
    { Id: '3', CategoryName: 'Medical' },
  ];
  // maps the appropriate column to fields property
  public fields: Object = { text: 'CategoryName', value: 'Id' };
  // set the height of the popup element
  public height: string = '220px';
  // set the placeholder to DropDownList input element
  public waterMark: string = 'Select an Expense Category';
  // set the value to select an item based on mapped value at initial rendering
  public value: string = 'Game3';
  public onChange(args: any): void {

  }

  onSubmit() {
    console.log(this.expenseForm.value);
  }


  checkValidity() {
    return this.expenseForm.status == 'VALID' ? true : false;
  }
}
