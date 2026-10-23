import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginModel } from '../../../models/loginModel';
import { money } from '../../_helpers/money';
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

  /**
   * Marketing illustration for the sign-in panel.
   *
   * The login page is public, so it must never carry a real ledger: no actual
   * spend total, no real category names. Everything below is a fabricated
   * sample with round numbers, and the card is labelled as an example so no
   * visitor can mistake it for their own data. The real figures live behind
   * `authGuard`, on the dashboard.
   */
  readonly preview = {
    label: 'Example month',
    total: 12480,
    segments: [
      { color: '#111111', width: 38 },
      { color: '#A6CF1D', width: 27 },
      { color: '#2F6FED', width: 16 },
      { color: '#E5539B', width: 11 },
      { color: '#8E6CD1', width: 8 },
    ],
    legend: [
      { label: 'Groceries', percent: 38 },
      { label: 'Bills', percent: 27 },
      { label: 'Transport', percent: 16 },
    ],
  };

  /** Formatted sample total, e.g. `₨12,480`. */
  readonly previewTotal = money(this.preview.total);

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
