import { Component } from '@angular/core';
import { LoginModel } from '../../../models/loginModel';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loginObj: LoginModel;
  constructor(private authService: AuthService, private router: Router) {
    this.loginObj = new LoginModel();
  }

  onSubmit() {
    this.authService
      .login(this.loginObj.email, this.loginObj.password)
      .subscribe(
        () => this.router.navigate(['/dashboard']),
        (error) => alert('Login failed')
      );
  }
}
