import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  @ViewChild('mobileDropdown', { static: false })
  mobileDropdown?: ElementRef<HTMLElement>;
  @ViewChild('avatarDropdown', { static: false })
  avatarDropdown?: ElementRef<HTMLElement>;
  @ViewChildren('submenuDetails')
  submenuDetails?: QueryList<ElementRef<HTMLDetailsElement>>;

  public isMobileMenuOpen = false;
  public isAvatarMenuOpen = false;

  public routeList: any[] = [
    {
      serial: 1,
      text: 'Dashboard',
      submenu: false,
      routerLink: '/dashboard',
    },
    {
      serial: 2,
      text: 'Expense',
      submenu: true,
      submenuList: [
        {
          text: 'Expense Table',
          routerLink: '/expense-table',
        },
        {
          text: 'Expense Form',
          routerLink: '/expense',
        },
      ],
    },
    {
      serial: 3,
      text: 'Expense Category',
      submenu: false,
      routerLink: '/expense-category',
    },
    {
      serial: 4,
      text: 'Receipt',
      submenu: false,
      routerLink: '/receipt',
    },
    {
      serial: 5,
      text: 'Current Needs',
      submenu: false,
      routerLink: '/current-needs',
    },
  ];

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.closeAll());
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) this.isAvatarMenuOpen = false;
  }

  toggleAvatarMenu(event: Event): void {
    event.stopPropagation();
    this.isAvatarMenuOpen = !this.isAvatarMenuOpen;
    if (this.isAvatarMenuOpen) this.isMobileMenuOpen = false;
  }

  closeAll(): void {
    this.isMobileMenuOpen = false;
    this.isAvatarMenuOpen = false;
    this.submenuDetails?.forEach((d) => (d.nativeElement.open = false));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (
      this.isMobileMenuOpen &&
      this.mobileDropdown &&
      !this.mobileDropdown.nativeElement.contains(target)
    ) {
      this.isMobileMenuOpen = false;
    }
    if (
      this.isAvatarMenuOpen &&
      this.avatarDropdown &&
      !this.avatarDropdown.nativeElement.contains(target)
    ) {
      this.isAvatarMenuOpen = false;
    }
    this.submenuDetails?.forEach((d) => {
      if (d.nativeElement.open && !d.nativeElement.contains(target)) {
        d.nativeElement.open = false;
      }
    });
  }
}
