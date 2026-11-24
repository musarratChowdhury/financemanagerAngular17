import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { MobileBarComponent } from './mobilebar.component';

/** The bar only asks for the token and, on sign-out, for the local wipe. */
class StorageStub {
  token = '';

  getUser(): string {
    return this.token;
  }

  clean = jasmine.createSpy('clean');
}

class AuthStub {
  logout = jasmine.createSpy('logout').and.returnValue(of({}));
}

/** Minimal unsigned JWT so the profile block has something to print. */
function fakeToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));

    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256' })}.${encode(claims)}.sig`;
}

describe('MobileBarComponent', () => {
  let fixture: ComponentFixture<MobileBarComponent>;
  let storage: StorageStub;
  let auth: AuthStub;

  beforeEach(async () => {
    storage = new StorageStub();
    storage.token = fakeToken({
      unique_name: 'musarrat',
      email: 'musarrat@example.com',
      iat: 1_700_000_000,
      exp: 1_700_010_800,
    });
    auth = new AuthStub();

    await TestBed.configureTestingModule({
      imports: [MobileBarComponent],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: storage },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileBarComponent);
    fixture.detectChanges();
  });

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function accountButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'button[aria-label="Account menu"]'
    );
  }

  function menuItems(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.syp-accountmenu__item')
    ).map((item) => (item as HTMLElement).textContent!.trim());
  }

  it('does not sign out when the account button is tapped', () => {
    accountButton().click();
    fixture.detectChanges();

    // The whole point of the change: a stray thumb must not end the session.
    expect(auth.logout).not.toHaveBeenCalled();
    expect(query('.syp-accountmenu')).not.toBeNull();
  });

  it('opens a menu offering Profile and Log out', () => {
    accountButton().click();
    fixture.detectChanges();

    expect(menuItems()).toContain('Profile');
    expect(menuItems()).toContain('Log out');
  });

  it('shows who is signed in, from the token', () => {
    accountButton().click();
    fixture.detectChanges();

    expect(query('.syp-accountmenu__name')!.textContent).toContain('musarrat');
    expect(query('.syp-accountmenu__email')!.textContent).toContain(
      'musarrat@example.com'
    );
  });

  it('advertises its expanded state for assistive tech', () => {
    expect(accountButton().getAttribute('aria-expanded')).toBe('false');

    accountButton().click();
    fixture.detectChanges();

    expect(accountButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the profile view from the menu', () => {
    accountButton().click();
    fixture.detectChanges();

    const profile = Array.from(
      fixture.nativeElement.querySelectorAll('.syp-accountmenu__item')
    ).find((item) => (item as HTMLElement).textContent!.includes('Profile')) as
      | HTMLElement
      | undefined;

    profile!.click();
    fixture.detectChanges();

    const sheet = query('[role="dialog"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.getAttribute('aria-modal')).toBe('true');
    expect(query('.syp-accountmenu')).toBeNull();
    expect(sheet!.textContent).toContain('musarrat@example.com');
  });

  it('signs out from the menu', () => {
    accountButton().click();
    fixture.detectChanges();

    const logout = Array.from(
      fixture.nativeElement.querySelectorAll('.syp-accountmenu__item')
    ).find((item) => (item as HTMLElement).textContent!.includes('Log out')) as
      | HTMLElement
      | undefined;

    logout!.click();
    fixture.detectChanges();

    expect(storage.clean).toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
    expect(TestBed.inject(Router)).toBeTruthy();
  });

  it('closes on Escape', () => {
    accountButton().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(query('.syp-accountmenu')).toBeNull();
  });
});
