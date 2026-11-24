import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ApiHealthService, ApiState } from '../../../services/api-health.service';

/** Short label per state - the text is what makes this more than a colour. */
const LABELS: Record<ApiState, string> = {
  checking: 'Checking…',
  online: 'Online',
  waking: 'Starting…',
  offline: 'Offline',
};

/**
 * "Is the API reachable?" chip.
 *
 * Rendered twice: in the phone app bar (`variant="bar"`, where space is tight so
 * CSS hides the label) and in the desktop rail (`variant="rail"`, on the dark
 * sidebar). Both read the same root `ApiHealthService`, so there is one polling
 * loop no matter how many instances are on screen.
 */
@Component({
  selector: 'app-api-status',
  standalone: true,
  templateUrl: './api-status.component.html',
  styleUrl: './api-status.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiStatusComponent {
  /** Where the chip is rendered; drives the colour treatment. */
  @Input() variant: 'bar' | 'rail' = 'bar';

  private readonly health = inject(ApiHealthService);

  readonly state = this.health.state;

  label(): string {
    return LABELS[this.state()];
  }

  /** Spoken form of the state, for the live region. */
  announcement(): string {
    switch (this.state()) {
      case 'online':
        return 'Backend online';
      case 'waking':
        return 'Backend starting up';
      case 'offline':
        return 'Backend offline';
      default:
        return 'Checking the backend';
    }
  }

  /**
   * Spoken and hover text: state, freshness, and the click affordance. A dot
   * alone would be useless to a screen reader and ambiguous to a colour-blind
   * reader, so the label and the per-state glyph carry the meaning too.
   */
  description(): string {
    const state = this.state();

    if (state === 'checking') return 'Checking whether the backend is reachable';

    const suffix =
      state === 'offline'
        ? ` · last checked ${this.checkedAgo()} · click to retry`
        : ` · checked ${this.checkedAgo()} · click to re-check`;

    return `Backend ${LABELS[state].replace('…', '')}${suffix}`;
  }

  /** Human-readable age of the last probe. */
  checkedAgo(): string {
    const at = this.health.lastCheckedAt();
    if (at === null) return 'not yet';

    const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.round(seconds / 60);
    return `${minutes}m ago`;
  }

  checkNow(): void {
    void this.health.checkNow({ force: true });
  }
}
