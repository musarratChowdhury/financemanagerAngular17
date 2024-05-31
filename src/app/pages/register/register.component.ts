import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  isFormValid = true;
  magicNumber = 100;
  isAdmin = true;
  /**
   *
   */
  constructor(private builder: FormBuilder) {}

  _regForm = this.builder.group({
    username: this.builder.control('', Validators.required),
    password: this.builder.control('', Validators.required),
    confirmPassword: this.builder.control('', Validators.required),
  });

  proceedRegister() {}

  createUser(e: Event) {
    console.log(e.target);
  }
}
