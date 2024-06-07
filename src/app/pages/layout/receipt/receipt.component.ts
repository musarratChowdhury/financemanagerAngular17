import {Component, OnInit, ViewChild} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  DropDownListModule,
} from '@syncfusion/ej2-angular-dropdowns';
import {ExpenseService} from '../../../services/expense.service';
import {ExpenseCategoryService} from '../../../services/expense-category.service';
import {ExpenseCategory} from '../../../../models/ExpenseCategory';
import {Expense} from '../../../../models/Expense';
import {GridComponent, GridModule, PageSettingsModel} from "@syncfusion/ej2-angular-grids";
import {ToastComponent, ToastModule} from "@syncfusion/ej2-angular-notifications";
import {NumericTextBoxModule, TextBoxModule} from "@syncfusion/ej2-angular-inputs";
import {DateTimePickerModule} from "@syncfusion/ej2-angular-calendars";

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DropDownListModule,
    ToastModule,
    GridModule,
    TextBoxModule,
    NumericTextBoxModule,
    DateTimePickerModule,
  ],
  templateUrl: './receipt.component.html',
  styleUrl: './receipt.component.css'
})

export class ReceiptComponent implements OnInit {
  public expenseCategoryList: ExpenseCategory[] = [];
  public expenseList: Expense[] = [];
  public pageSettings?: PageSettingsModel;
  public position = { X: 'Right' };
  @ViewChild('notification') public notification?: ToastComponent;
  @ViewChild('notification_title') public notification_title: any;
  @ViewChild('notification_content') public notification_content: any;
  @ViewChild('grid')
  public grid?: GridComponent;

  constructor(
    private formBuilder: FormBuilder,
    private expenseCategoryService: ExpenseCategoryService
  ) {
  }

  ngOnInit(): void {
    this.pageSettings = {pageSize: 10};
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
  public fields: Object = {text: 'name', value: 'id'};
  // set the height of the popup element
  public height: string = '220px';
  // set the placeholder to DropDownList input element
  public waterMark: string = 'Select an Expense Category';


  onSubmit() {
    console.log(this.expenseForm.value);


    const expenseName = this.expenseForm.get('expenseName')?.value;

    if (this.expenseList.find(expense => expense.Cause === expenseName)) {
      // this.createNotification("Error", "Expense already exists")
      return;
    }

    if (this.checkValidity()) {
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

      // console.log(this.grid)

      this.expenseList.push(newExpense);

      if (this.grid) {
        this.grid.refresh();
      }

    }
  }

  onCreate(args: any) {
    console.log(this.notification)
  }

  checkValidity() {
    return this.expenseForm.status == 'VALID' ? true : false;
  }

  createNotification(title:string, content:string) {
    this.notification_title.innerText = title;
    this.notification_content.innerText = content;
    this.notification?.show();
  }
}
