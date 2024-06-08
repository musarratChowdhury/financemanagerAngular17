import { Component, OnInit } from '@angular/core';
import { LoginModel } from '../../../models/loginModel';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  loginObj: LoginModel;
  isLoggedIn = false;
  isLoginFailed = false;
  errorMessage = '';
  roles: string[] = [];
  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router
  ) {
    this.loginObj = new LoginModel();
  }
  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit() {
    this.authService
      .login(this.loginObj.email, this.loginObj.password)
      .subscribe({
        next: (data) => {
          this.storageService.saveUser(data.token);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMessage = err.error.message;
          this.isLoginFailed = true;
        },
      });
  }
}
