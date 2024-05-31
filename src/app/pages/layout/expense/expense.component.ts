import {Component} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule
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

  onSubmit() {
    console.log(this.expenseForm.value);
  }


  checkValidity() {
    return this.expenseForm.status == 'VALID' ? true : false;
  }
}
