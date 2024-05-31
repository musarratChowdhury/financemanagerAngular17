import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

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

  _regForm = new FormGroup({
    username: new FormControl('', Validators.email),
    password: new FormControl('', Validators.required),
    confirmPassword: new FormControl('', Validators.required),
  });

  proceedRegister() {}

  createUser(e: Event) {
    console.log(e.target);
  }

  checkValidity() {
    return this._regForm.status == 'VALID' ? true : false;
  }
}
