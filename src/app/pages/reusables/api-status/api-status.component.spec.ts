import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ApiHealthService, ApiState } from '../../../services/api-health.service';
import { ApiStatusComponent } from './api-status.component';

/** Stand-in for the polling service: the component only reads its signals. */
class HealthStub {
  private readonly stateSignal = signal<ApiState>('online');
  private readonly checkedSignal = signal<number | null>(Date.now());

  readonly state = this.stateSignal.asReadonly();
  readonly lastCheckedAt = this.checkedSignal.asReadonly();

  checkNow = jasmine.createSpy('checkNow').and.resolveTo('online' as ApiState);

  set(state: ApiState, checkedAt: number | null = Date.now()): void {
    this.stateSignal.set(state);
    this.checkedSignal.set(checkedAt);
  }
}

describe('ApiStatusComponent', () => {
  let fixture: ComponentFixture<ApiStatusComponent>;
  let health: HealthStub;

  beforeEach(async () => {
    health = new HealthStub();

    await TestBed.configureTestingModule({
      imports: [ApiStatusComponent],
      providers: [{ provide: ApiHealthService, useValue: health }],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiStatusComponent);
    fixture.detectChanges();
  });

  function label(): string {
    return (
      fixture.nativeElement.querySelector('.apistat__label')?.textContent ?? ''
    ).trim();
  }

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.apistat');
  }

  it('renders the state as text, not just a colour', () => {
    health.set('online');
    fixture.detectChanges();
    expect(label()).toBe('Online');

    health.set('waking');
    fixture.detectChanges();
    expect(label()).toBe('Starting…');

    health.set('offline');
    fixture.detectChanges();
    expect(label()).toBe('Offline');
  });

  it('mirrors the state into a class, so the colour can follow it', () => {
    health.set('offline');
    fixture.detectChanges();

    expect(button().className).toContain('is-offline');
    expect(button().className).toContain('apistat--bar');
  });

  it('explains the state and the click in its accessible name', () => {
    health.set('offline', Date.now() - 12_000);
    fixture.detectChanges();

    const name = button().getAttribute('aria-label') ?? '';
    expect(name).toContain('Backend Offline');
    expect(name).toContain('12s ago');
    expect(name).toContain('click to retry');
  });

  it('announces changes politely rather than interrupting', () => {
    health.set('offline');
    fixture.detectChanges();

    const live = fixture.nativeElement.querySelector('[role="status"]');

    // The live region is a sibling of the button, so its text does not compete
    // with the button's accessible name.
    expect(live).not.toBeNull();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toContain('Backend offline');
    expect(live.classList).toContain('syp-sr-only');
  });

  it('forces a re-check when tapped', () => {
    button().click();

    expect(health.checkNow).toHaveBeenCalledWith({ force: true });
  });

  it('cannot be tapped while a probe is already running', () => {
    health.set('checking');
    fixture.detectChanges();

    expect(button().disabled).toBeTrue();
  });
});
