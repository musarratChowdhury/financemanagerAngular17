import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GeminiAttempt,
  GeminiModelsResponse,
  GeminiOutcome,
  ReceiptScannerService,
} from './receipt-scanner.service';
import { SETTING_KEYS, SettingsService } from './settings.service';

const MODEL_KEY = 'syp-receipt-model';
const TESTS_KEY = 'syp-receipt-model-tests';

export interface SavedReceiptModel {
  model: string;
  /**
   * `manual` — the user picked it, so no automatic sweep may replace it.
   * `auto`   — the startup sweep picked it; a later sweep may pick again.
   */
  source: 'auto' | 'manual';
  savedAt: string;
}

/** Last known verdict for one model, so the picker can annotate it without a call. */
export interface ModelTestRecord {
  model: string;
  outcome: GeminiOutcome;
  at: string;
  httpStatus: number | null;
  message: string | null;
  rawResponse: string | null;
}

export type SweepStatus = 'idle' | 'running' | 'done' | 'error';

export interface SweepState {
  status: SweepStatus;
  winner: string | null;
  results: GeminiAttempt[];
  probeMode?: 'receipt' | 'text';
  cached?: boolean;
  at?: string;
  message?: string;
}

/**
 * The receipt-scan model choice, and the availability sweep that maintains it.
 *
 * The choice is stored on the server (`Settings` table, key `ReceiptScanModel`)
 * so it follows the account rather than the browser — that is what makes
 * "save the model, sign in on another device, it is still selected" work.
 * `localStorage` is only a write-through cache: it keeps the choice available
 * before the first request completes, and while the API is unreachable.
 *
 * An automatic sweep winner is deliberately **not** written to the server. It is
 * a device-local hint, so one browser probing a catalogue cannot overwrite the
 * model another device explicitly chose.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptModelService {
  private readonly scanner = inject(ReceiptScannerService);
  private readonly settings = inject(SettingsService);

  readonly saved = signal<SavedReceiptModel | null>(readJson<SavedReceiptModel>(MODEL_KEY));
  readonly tests = signal<Record<string, ModelTestRecord>>(
    readJson<Record<string, ModelTestRecord>>(TESTS_KEY) ?? {}
  );
  readonly sweep = signal<SweepState>({ status: 'idle', winner: null, results: [] });

  /** Set while a scan is in flight, so the sweep does not compete for the same key. */
  readonly scanInProgress = signal(false);

  /** The chosen model, or null to let the server use its configured default. */
  readonly model = computed(() => this.saved()?.model ?? null);

  /** Models with a recorded verdict of "cannot read receipts". */
  readonly unavailable = computed(() => {
    const tests = this.tests();
    return new Set(
      Object.values(tests)
        .filter((test) => HARD_FAILURES.has(test.outcome))
        .map((test) => test.model)
    );
  });

  /* --------------------------------------------------------------- choices */

  /**
   * The account-wide choice, fetched once per session. A value stored on the
   * server is by definition an explicit choice, so it adopts the `manual`
   * source and the sweep will not replace it.
   *
   * Returns the model it adopted, or null when the server has none. Never
   * throws: a failed read must not break the app, it just leaves the cache in
   * charge.
   */
  async loadFromServer(): Promise<string | null> {
    try {
      const model = await this.settings.getString(SETTING_KEYS.receiptScanModel);
      if (!model) return null;

      const current = this.saved();
      if (current?.model === model && current.source === 'manual') return model;

      this.persist({ model, source: 'manual', savedAt: new Date().toISOString() });
      return model;
    } catch {
      // Offline or the API is older than this screen: keep the cached choice.
      return null;
    }
  }

  /**
   * Saves the model for the account. The local cache is updated first so the UI
   * and any scan in flight use it immediately; the returned promise rejects when
   * the server write failed, so the caller can say so.
   */
  async saveManual(model: string): Promise<void> {
    this.persist({ model, source: 'manual', savedAt: new Date().toISOString() });
    await this.settings.setString(SETTING_KEYS.receiptScanModel, model);
  }

  /**
   * Adopts an automatically discovered model — but never on top of a manual
   * choice, which is the one thing the user asked us not to second-guess.
   * Local only: this is not written to the account setting.
   * Returns true when the choice actually changed.
   */
  saveAuto(model: string): boolean {
    const current = this.saved();
    if (current?.source === 'manual') return false;
    if (current?.source === 'auto' && current.model === model) return false;

    this.persist({ model, source: 'auto', savedAt: new Date().toISOString() });
    return true;
  }

  /** Drops both the account setting and the cache, so the server default applies. */
  async clear(): Promise<void> {
    this.saved.set(null);
    remove(MODEL_KEY);
    await this.settings.remove(SETTING_KEYS.receiptScanModel);
  }

  /* ----------------------------------------------------------- test records */

  recordTest(record: ModelTestRecord): void {
    const next = { ...this.tests(), [record.model]: record };
    this.tests.set(next);
    writeJson(TESTS_KEY, next);
  }

  testOf(model: string): ModelTestRecord | null {
    return this.tests()[model] ?? null;
  }

  clearTests(): void {
    this.tests.set({});
    remove(TESTS_KEY);
  }

  /* --------------------------------------------------------------- the sweep */

  /**
   * Asks the API which models can read a receipt right now, then adopts the
   * winner when the user has not made a manual choice.
   *
   * Order is deliberate: the saved model first (confirm the current choice),
   * then the server default, then everything else the key can call.
   */
  async runSweep(fresh = false): Promise<void> {
    if (this.sweep().status === 'running' || this.scanInProgress()) return;

    this.sweep.set({ status: 'running', winner: null, results: [] });

    try {
      const catalogue = await this.scanner.listModels();

      if (!catalogue.keyConfigured) {
        this.sweep.set({
          status: 'error',
          winner: null,
          results: [],
          message: 'The server has no GEMINI_API_KEY configured.',
        });
        return;
      }

      const candidates = orderCandidates(catalogue, this.model(), this.tests());
      const probe = await this.scanner.probe(candidates, fresh);

      this.sweep.set({
        status: 'done',
        winner: probe.winner,
        results: probe.results,
        probeMode: probe.probeMode,
        cached: probe.cached,
        at: probe.checkedAt,
      });

      for (const attempt of probe.results) {
        this.recordTest({
          model: attempt.model,
          outcome: attempt.outcome,
          at: probe.checkedAt,
          httpStatus: attempt.httpStatus,
          message: attempt.message,
          rawResponse: attempt.rawResponse,
        });
      }

      if (probe.winner) this.saveAuto(probe.winner);
    } catch (error) {
      this.sweep.set({
        status: 'error',
        winner: null,
        results: [],
        message:
          error instanceof Error
            ? error.message
            : 'The availability check could not reach the API.',
      });
    }
  }

  /* ------------------------------------------------------------------ storage */

  private persist(value: SavedReceiptModel): void {
    this.saved.set(value);
    writeJson(MODEL_KEY, value);
  }
}

/** Outcomes that mean "this model will not read a receipt" — not worth retrying soon. */
const HARD_FAILURES = new Set<GeminiOutcome>([
  'not_found',
  'no_generate_content',
  'unsupported',
  'no_image_support',
  'invalid_request',
  'auth_error',
]);

/**
 * Upper bound on how many models one sweep may call. Each candidate costs a real
 * Gemini request, so an exhausted-but-not-quota key must not turn into forty of
 * them. The order below is what keeps the cap harmless: the models most likely to
 * work are always inside it.
 */
const MAX_SWEEP_CANDIDATES = 12;

/**
 * Priority: the saved model (confirm the current choice), the server default, then
 * models with a known-good verdict, then untested ones, then soft failures, and
 * finally the ones already known to be unusable — so a recovered model is still
 * rediscovered after the server-side cache expires, just last.
 */
function orderCandidates(
  catalogue: GeminiModelsResponse,
  savedModel: string | null,
  tests: Record<string, ModelTestRecord>
): string[] {
  const callable = catalogue.models
    .filter((model) => model.supportsGenerateContent)
    .map((model) => model.name);

  const rank = (name: string): number => {
    const outcome = tests[name]?.outcome;
    if (!outcome || outcome === 'skipped') return 1;
    if (outcome === 'ok') return 0;
    return HARD_FAILURES.has(outcome) ? 3 : 2;
  };

  const ordered: string[] = [];
  const add = (name: string | null | undefined) => {
    if (name && !ordered.includes(name)) ordered.push(name);
  };

  add(savedModel);
  add(catalogue.defaultModel);

  callable
    .filter((name) => name !== savedModel && name !== catalogue.defaultModel)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .forEach(add);

  return ordered.slice(0, MAX_SWEEP_CANDIDATES);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage full: the choice simply will not survive a reload.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignored for the same reason as above.
  }
}
