import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MobileBarComponent } from '../../reusables/mobilebar/mobilebar.component';
import { ReceiptModelService } from '../../../services/receipt-model.service';
import {
  GeminiAttempt,
  GeminiModel,
  GeminiModelsResponse,
  ReceiptScanError,
  ReceiptScannerService,
} from '../../../services/receipt-scanner.service';
import { money } from '../../../_helpers/money';

interface TestOutcome {
  ok: boolean;
  model: string;
  at: string;
  elapsedMs: number;
  merchant?: string | null;
  total?: number | null;
  itemCount?: number;
  message?: string;
  attempts: GeminiAttempt[];
}

/**
 * Settings — choose and prove the Gemini model used for receipt scanning.
 *
 * The page is deliberately blunt about failures: a retired model, an exhausted
 * quota and a text-only model each show Gemini's own JSON, because "scan failed"
 * tells the user nothing actionable.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MobileBarComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private readonly scanner = inject(ReceiptScannerService);
  readonly models = inject(ReceiptModelService);
  readonly money = money;

  readonly catalogue = signal<GeminiModelsResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly selected = signal('');
  readonly testing = signal(false);
  readonly test = signal<TestOutcome | null>(null);
  readonly flash = signal('');
  readonly customFile = signal<File | null>(null);

  /** The model a scan will use right now. */
  readonly effectiveModel = computed(
    () => this.models.model() ?? this.catalogue()?.defaultModel ?? ''
  );

  readonly saved = this.models.saved;
  readonly sweep = this.models.sweep;

  /** True when the API answered 404 for /Models — i.e. it was deployed before this screen. */
  readonly apiOutdated = computed(() => this.loadError().includes('404'));

  /** Models that can actually generate content, plus whatever is currently chosen. */
  readonly options = computed(() => {
    const catalogue = this.catalogue();
    if (!catalogue) return [];

    const callable = catalogue.models.filter((model) => model.supportsGenerateContent);
    const chosen = this.selected();
    const missing = chosen && !callable.some((model) => model.name === chosen);

    return missing
      ? [
          ...callable,
          {
            name: chosen,
            displayName: null,
            version: null,
            description: null,
            inputTokenLimit: null,
            outputTokenLimit: null,
            supportedGenerationMethods: [],
            supportsGenerateContent: true,
          } as GeminiModel,
        ]
      : callable;
  });

  /** Models the key can see but which cannot read a receipt at all. */
  readonly excluded = computed(() =>
    (this.catalogue()?.models ?? []).filter((model) => !model.supportsGenerateContent)
  );

  /** Gemini's own replacement suggestion, when the last test found a retired model. */
  readonly suggestion = computed(() => {
    const outcome = this.test();
    if (!outcome || outcome.ok) return null;
    const suggested = outcome.attempts.find((a) => a.suggestedModel)?.suggestedModel ?? null;
    if (!suggested || suggested === this.selected()) return null;
    return suggested;
  });

  /** The raw body of the first failed attempt — the message worth showing verbatim. */
  readonly rawFailure = computed(() => {
    const outcome = this.test();
    if (!outcome || outcome.ok) return '';
    const raw = outcome.attempts.find((a) => a.rawResponse)?.rawResponse ?? '';
    return this.pretty(raw);
  });

  ngOnInit(): void {
    void this.loadCatalogue();
  }

  async loadCatalogue(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');

    try {
      const catalogue = await this.scanner.listModels();
      this.catalogue.set(catalogue);
      if (!this.selected()) {
        this.selected.set(this.models.model() ?? catalogue.defaultModel ?? '');
      }
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? error.message : 'Could not load the model list.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  /* ------------------------------------------------------------------ model */

  labelFor(model: GeminiModel): string {
    const base = model.displayName?.trim() || model.name;
    return `${this.markerFor(model.name)}${base}`;
  }

  /** ✓ works, ✗ cannot read receipts, ⚠ worth retrying later. */
  markerFor(name: string): string {
    const test = this.models.tests()[name];
    if (!test || test.outcome === 'skipped') return '';
    if (test.outcome === 'ok') return '✓ ';
    return this.models.unavailable().has(name) ? '✗ ' : '⚠ ';
  }

  onSelect(name: string): void {
    this.selected.set(name);
    this.test.set(null);
    this.flash.set('');
  }

  save(): void {
    const model = this.selected();
    if (!model) return;
    this.models.saveManual(model);
    this.flash.set(`${model} will be used for receipt scans on this device.`);
  }

  useServerDefault(): void {
    this.models.clear();
    this.selected.set(this.catalogue()?.defaultModel ?? '');
    this.flash.set('Cleared your choice — the server default is in use.');
  }

  useSuggestion(): void {
    const suggested = this.suggestion();
    if (!suggested) return;
    this.selected.set(suggested);
    this.test.set(null);
    this.flash.set(`Switched to Gemini's suggested replacement: ${suggested}. Test it, then save.`);
  }

  recheck(): void {
    void this.models.runSweep(true);
  }

  /* ------------------------------------------------------------------- test */

  async runTest(): Promise<void> {
    const model = this.selected();
    if (!model || this.testing()) return;

    this.testing.set(true);
    this.test.set(null);
    this.flash.set('');
    const started = Date.now();
    const at = new Date().toISOString();

    try {
      const file = await this.sampleFile();
      const result = await this.scanner.recognize(file, model, true);
      const elapsedMs = Date.now() - started;

      this.test.set({
        ok: true,
        model: result.modelUsed ?? model,
        at,
        elapsedMs,
        merchant: result.merchant,
        total: result.total,
        itemCount: result.items?.length ?? 0,
        attempts: [],
      });
      this.models.recordTest({
        model,
        outcome: 'ok',
        at,
        httpStatus: 200,
        message: null,
        rawResponse: null,
      });
    } catch (error) {
      const attempts = error instanceof ReceiptScanError ? error.attempts : [];
      const first = attempts[0];
      const message =
        error instanceof Error ? error.message : 'The test could not run.';

      this.test.set({
        ok: false,
        model,
        at,
        elapsedMs: Date.now() - started,
        message,
        attempts,
      });
      this.models.recordTest({
        model,
        outcome: first?.outcome ?? 'unknown',
        at,
        httpStatus: first?.httpStatus ?? null,
        message: first?.message ?? message,
        rawResponse: first?.rawResponse ?? null,
      });
    } finally {
      this.testing.set(false);
    }
  }

  onCustomFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.customFile.set(input.files?.[0] ?? null);
    this.test.set(null);
    input.value = '';
  }

  useSampleAgain(): void {
    this.customFile.set(null);
    this.test.set(null);
  }

  /** The bundled sample, unless the user supplied their own image. */
  private async sampleFile(): Promise<File> {
    const custom = this.customFile();
    if (custom) return custom;

    const response = await fetch('samples/receipt-sample.jpg');
    if (!response.ok) {
      throw new Error(
        `Could not load the sample receipt (${response.status}). Upload your own instead.`
      );
    }

    return new File([await response.blob()], 'receipt-sample.jpg', {
      type: 'image/jpeg',
    });
  }

  pretty(raw: string): string {
    if (!raw) return '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  /** Outcomes that will not change on their own — the model is simply not usable. */
  isHard(outcome: string): boolean {
    return [
      'not_found',
      'no_generate_content',
      'unsupported',
      'no_image_support',
      'invalid_request',
      'auth_error',
    ].includes(outcome);
  }

  trackModel(_: number, model: GeminiModel): string {
    return model.name;
  }

  /** Local clock time for a sweep, and date + time for a saved choice. */
  timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  whenOf(iso: string): string {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
