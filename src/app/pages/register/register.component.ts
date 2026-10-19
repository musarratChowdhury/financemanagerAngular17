import { Component, computed, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Create account.
 *
 * Mobile-first: the form comes first and the three-step explainer sits below
 * it. From 768px they sit side by side, form on the left as in the design.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  /** Drives the 4-segment strength meter under the password field. */
  readonly password = signal('');
  readonly termsAccepted = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly success = signal(false);

  readonly strength = computed(() => scorePassword(this.password()));

  readonly regForm = this.builder.group({
    fullName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    currency: ['PKR'],
    monthlyIncome: [''],
  });

  constructor(
    private builder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  onPasswordInput(value: string): void {
    this.password.set(value);
  }

  get passwordsMatch(): boolean {
    return this.regForm.value.password === this.regForm.value.confirmPassword;
  }

  get canSubmit(): boolean {
    return this.regForm.valid && this.passwordsMatch && this.termsAccepted();
  }

  proceedRegister(): void {
    if (!this.canSubmit || this.submitting()) return;

    const { email, password, fullName } = this.regForm.value;

    this.submitting.set(true);
    this.errorMessage.set('');

    // The API takes (username, email, password). The form collects a display
    // name, so fall back to the email's local part when it is blank.
    const username =
      (fullName ?? '').trim() || (email ?? '').split('@')[0] || 'User';

    this.authService.register(username, email!, password!).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
        // Let the confirmation land before moving them to sign in.
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(
          err?.error?.message ??
            'We could not create your account. Please try again.'
        );
      },
    });
  }
}

/** Very small heuristic — length plus character-class variety, 0..4. */
function scorePassword(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4);
}
