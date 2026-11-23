import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';

/**
 * Sticky phone app bar. Mirrors the mobile frame: brand mark on the left, the
 * screen's own title beside it, and a single account affordance on the right.
 *
 * `RouterLink` must stay in `imports`: the budgets and settings affordances use
 * static `routerLink`s, which Angular silently ignores when the directive is
 * missing - the anchor renders without an href and the tap does nothing. The
 * same holds for `RouterLinkActive`, which colours the current destination.
 */
@Component({
  selector: 'app-mobilebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './mobilebar.component.html',
  styleUrl: './mobilebar.component.css',
})
export class MobileBarComponent {
  /** Screen title; falls back to the brand name on the dashboard. */
  @Input() title = 'Save Your Penny';

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router
  ) {}

  signOut(): void {
    // Clear locally first so a failed server call cannot strand the user.
    this.storageService.clean();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
