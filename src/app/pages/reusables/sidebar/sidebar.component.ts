import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';

interface NavItem {
  label: string;
  link: string;
  /** SVG path data, matching the icon set used in the design. */
  path: string;
}

/**
 * Desktop navigation rail. Hidden below 1024px, where the tab bar takes over.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly nav: NavItem[] = [
    {
      label: 'Dashboard',
      link: '/dashboard',
      path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    },
    {
      label: 'Expenses',
      link: '/expenses',
      path: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    },
    {
      label: 'Scan receipt',
      link: '/scan-receipt',
      path: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    },
    {
      label: 'Categories',
      link: '/categories',
      path: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
    },
    {
      label: 'Cash flow',
      link: '/cash-flow',
      path: 'M22 12h-4l-3 9L9 3l-3 9H2',
    },
    {
      label: 'Current needs',
      link: '/current-needs',
      path: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    },
  ];

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
