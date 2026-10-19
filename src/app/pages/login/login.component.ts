import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginModel } from '../../../models/loginModel';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';

/**
 * Sign in.
 *
 * Mobile-first: a single column with the brand block on top. From 768px the
 * dark pitch panel and the form sit side by side (the design's split shell).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  loginObj: LoginModel = new LoginModel();

  loading = false;
  isLoginFailed = false;
  errorMessage = '';
  keepSignedIn = true;

  /** Sample split for the preview card; replaced by real data once signed in. */
  readonly previewSegments = [
    { color: '#111111', width: 39.5 },
    { color: '#A6CF1D', width: 34.66 },
    { color: '#2F6FED', width: 12.52 },
    { color: '#E5539B', width: 5.74 },
    { color: '#8E6CD1', width: 3.64 },
    { color: '#F59E0B', width: 1.78 },
    { color: '#14B8A6', width: 0.86 },
    { color: '#8A8A83', width: 0.86 },
    { color: '#0EA5E9', width: 0.44 },
  ];

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.storageService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  onSubmit(): void {
    if (this.loading) return;

    this.loading = true;
    this.isLoginFailed = false;
    this.errorMessage = '';

    this.authService.login(this.loginObj.email, this.loginObj.password).subscribe({
      next: (data) => {
        this.storageService.saveUser(data.token);
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        // The API sends { message }; fall back to something human if it does not.
        this.errorMessage =
          err?.error?.message ?? 'We could not sign you in. Please try again.';
        this.isLoginFailed = true;
        this.loading = false;
      },
    });
  }
}
