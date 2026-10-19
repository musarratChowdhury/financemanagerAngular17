import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  ViewChildren,
  QueryList,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ConnectivityService } from '../../../services/connectivity.service';
import { OfflineSyncService } from '../../../services/offline-sync.service';
import { OfflineStoreService } from '../../../services/offline-store.service';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
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
    {
      serial: 6,
      text: 'Cash Flow',
      submenu: false,
      routerLink: '/cash-flow',
    },
    {
      serial: 7,
      text: 'Envelopes',
      submenu: false,
      routerLink: '/envelopes',
    },
  ];

  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly offlineStore = inject(OfflineStoreService);
  private readonly authService = inject(AuthService);
  private readonly storageService = inject(StorageService);

  /** Reactive online state from ConnectivityService. */
  readonly online = this.connectivity.online;

  /** Pending write count for the sync badge. */
  pendingCount = 0;

  /** Whether a sync is currently in progress. */
  syncing = false;

  private unsubscribeSync?: () => void;
  private unsubscribeOnline?: () => void;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.closeAll());
  }

  ngOnInit(): void {
    // Subscribe to sync state changes
    this.unsubscribeSync = this.offlineSync.onSyncChange(() => {
      this.syncing = this.offlineSync.syncing;
      this.updatePendingCount();
    });

    // Also listen for online events to update count
    this.unsubscribeOnline = this.offlineSync.onSyncChange(() => {});
    // Initial count
    this.updatePendingCount();

    // Listen for connectivity changes to trigger sync
    window.addEventListener('online', () => this.onConnectivityRestored());
  }

  ngOnDestroy(): void {
    this.unsubscribeSync?.();
    this.unsubscribeOnline?.();
    window.removeEventListener('online', () => this.onConnectivityRestored());
  }

  signOut(): void {
    // Clear offline data first so a failed server call cannot strand the user
    this.offlineStore.clearUserData().then(() => {
      this.storageService.clean();
      this.authService.logout().subscribe({
        next: () => this.router.navigate(['/login']),
        error: () => this.router.navigate(['/login']),
      });
    });
  }

  private async onConnectivityRestored(): Promise<void> {
    await this.offlineSync.onOnline();
    this.updatePendingCount();
  }

  private async updatePendingCount(): Promise<void> {
    this.pendingCount = await this.offlineStore.getQueueCount();
  }

  /** Manual sync trigger. */
  async syncNow(): Promise<void> {
    await this.offlineSync.syncNow();
    this.updatePendingCount();
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
