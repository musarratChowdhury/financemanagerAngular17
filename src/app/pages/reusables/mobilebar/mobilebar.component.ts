import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { ApiStatusComponent } from '../api-status/api-status.component';
import { TokenProfile, readStoredProfile } from '../../../_helpers/jwt';

/**
 * Sticky phone app bar. Mirrors the mobile frame: brand mark on the left, the
 * screen's own title beside it, and the account affordance on the right.
 *
 * The account button opens a menu (Profile / Log out) instead of signing out on
 * tap: an accidental thumb on the corner should not end the session.
 *
 * `RouterLink` must stay in `imports`: the budgets and settings affordances use
 * static `routerLink`s, which Angular silently ignores when the directive is
 * missing - the anchor renders without an href and the tap does nothing. The
 * same holds for `RouterLinkActive`, which colours the current destination.
 */
@Component({
  selector: 'app-mobilebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ApiStatusComponent,
  ],
  templateUrl: './mobilebar.component.html',
  styleUrl: './mobilebar.component.css',
})
export class MobileBarComponent {
  /** Screen title; falls back to the brand name on the dashboard. */
  @Input() title = 'Save Your Penny';

  @ViewChild('accountWrap') private accountWrap?: ElementRef<HTMLElement>;
  @ViewChild('profileDone') private profileDone?: ElementRef<HTMLButtonElement>;

  /** Who is signed in, read from the access token's claims (there is no /me). */
  readonly profile: TokenProfile | null;

  /** Two-letter monogram for the avatar / sheet. */
  readonly initials: string;

  private readonly authService = inject(AuthService);
  private readonly storageService = inject(StorageService);
  private readonly router = inject(Router);

  constructor() {
    this.profile = readStoredProfile(this.storageService.getUser());
    this.initials = monogram(this.profile);
  }

  // --------------------------------------------------------------- menu state

  private accountMenuOpen = false;
  private profileOpen = false;

  /** Template reads these through getters so plain fields still drive CD. */
  get accountMenuIsOpen(): boolean {
    return this.accountMenuOpen;
  }

  get profileIsOpen(): boolean {
    return this.profileOpen;
  }

  toggleAccountMenu(event: Event): void {
    // Keep the document listener below from closing it in the same click.
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
    if (this.accountMenuOpen) this.profileOpen = false;
  }

  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  openProfile(): void {
    this.accountMenuOpen = false;
    this.profileOpen = true;

    // Move focus into the sheet, or a keyboard user stays behind the backdrop.
    setTimeout(() => this.profileDone?.nativeElement.focus(), 0);
  }

  closeProfile(): void {
    this.profileOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.accountMenuOpen) return;

    const target = event.target as Node | null;
    const host = this.accountWrap?.nativeElement;

    if (host && target && !host.contains(target)) this.accountMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.accountMenuOpen = false;
    this.profileOpen = false;
  }

  // ------------------------------------------------------------------ format

  /** "Signed in" / "Session ends" values; the claim may be absent. */
  formatTime(epochMs: number | null): string {
    if (!epochMs) return 'Not recorded';

    return new Date(epochMs).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // ----------------------------------------------------------------- actions

  signOut(): void {
    this.accountMenuOpen = false;

    // Clear locally first so a failed server call cannot strand the user.
    this.storageService.clean();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}

/** First two alphanumerics of the name, then the email, then the brand mark. */
function monogram(profile: TokenProfile | null): string {
  const source = profile?.userName || profile?.email || '';
  const letters = source.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();

  return letters || 'SP';
}
