import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReceiptScanItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
}

export interface ReceiptScanResult {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: ReceiptScanItem[];
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  rawTotalText: string | null;
  itemsMatchTotal: boolean;
  needsReview: boolean;
  /** Model that actually answered. Differs from the requested one after a fallback. */
  modelUsed?: string | null;
}

export type GeminiOutcome =
  | 'ok'
  | 'not_found'
  | 'busy'
  | 'quota'
  | 'auth_error'
  | 'invalid_request'
  | 'timeout'
  | 'upstream_error'
  | 'empty_response'
  | 'invalid_json'
  | 'skipped'
  | 'no_generate_content'
  | 'unsupported'
  | 'no_image_support'
  | 'unknown';

/** One model attempt, as reported by the API. */
export interface GeminiAttempt {
  model: string;
  outcome: GeminiOutcome;
  retryable: boolean;
  httpStatus: number | null;
  errorStatus: string | null;
  elapsedMs: number;
  message: string | null;
  /** Replacement Gemini suggested in a deprecation message. */
  suggestedModel: string | null;
  /** Verbatim upstream body — the interesting part of every Gemini error. */
  rawResponse: string | null;
}

export interface GeminiModel {
  name: string;
  version: string | null;
  displayName: string | null;
  description: string | null;
  inputTokenLimit: number | null;
  outputTokenLimit: number | null;
  supportedGenerationMethods: string[];
  /** False for embeddings / aqa-style models that cannot produce content at all. */
  supportsGenerateContent: boolean;
}

export interface GeminiModelsResponse {
  models: GeminiModel[];
  defaultModel: string;
  keyConfigured: boolean;
  attemptTimeoutSeconds: number;
  checkedAt: string;
}

export interface GeminiProbeResponse {
  winner: string | null;
  results: GeminiAttempt[];
  keyConfigured: boolean;
  probeMode: 'receipt' | 'text';
  cached: boolean;
  checkedAt: string;
}

/**
 * A scan that ran out of models. The API answers 502 with one entry per model it
 * tried, so the UI can show Gemini's own message instead of a generic failure.
 */
export class ReceiptScanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly attempts: GeminiAttempt[]
  ) {
    super(message);
    this.name = 'ReceiptScanError';
  }
}

@Injectable({ providedIn: 'root' })
export class ReceiptScannerService {
  constructor(private http: HttpClient) {}

  /**
   * Reads a receipt.
   *
   * @param model  Model to ask for. Omitted, the server uses its configured default.
   * @param strict Ask only that model — used by the settings screen's test button so
   *               the server's fallback chain cannot make a dead model look healthy.
   */
  recognize(
    image: File,
    model?: string | null,
    strict = false
  ): Promise<ReceiptScanResult> {
    const formData = new FormData();
    formData.append('file', image, image.name);
    if (model) formData.append('model', model);
    if (strict) formData.append('strict', 'true');

    return firstValueFrom(
      this.http.post<ReceiptScanResult>(
        `${environment.apiUrl}/api/Receipt/Scan`,
        formData
      )
    ).catch((error: unknown) => {
      throw this.toScanError(error);
    });
  }

  listModels(): Promise<GeminiModelsResponse> {
    return firstValueFrom(
      this.http.get<GeminiModelsResponse>(
        `${environment.apiUrl}/api/Receipt/Models`
      )
    ).catch((error: unknown) => {
      throw this.toScanError(error);
    });
  }

  /** Server-side availability sweep over the sample receipt. */
  probe(models?: string[], fresh = false): Promise<GeminiProbeResponse> {
    return firstValueFrom(
      this.http.post<GeminiProbeResponse>(
        `${environment.apiUrl}/api/Receipt/Probe`,
        { models: models ?? null, fresh }
      )
    ).catch((error: unknown) => {
      throw this.toScanError(error);
    });
  }

  private toScanError(error: unknown): unknown {
    if (!(error instanceof HttpErrorResponse)) return error;

    const body = error.error as
      | { message?: string; attempts?: GeminiAttempt[] }
      | string
      | null;

    const attempts =
      body && typeof body === 'object' && Array.isArray(body.attempts)
        ? body.attempts
        : [];

    const detail =
      typeof body === 'string'
        ? body
        : body?.message ?? error.message;

    // Fold the per-model verdicts into the message: the scan screen shows only
    // this string, and "404 NOT_FOUND — this model is no longer available" is the
    // sentence the user needs, not "receipt scan failed".
    const summary = attempts
      .map((attempt) => {
        const code = attempt.httpStatus ? ` ${attempt.httpStatus}` : '';
        const why = attempt.message ? ` — ${attempt.message}` : '';
        return `${attempt.model}: ${attempt.outcome}${code}${why}`;
      })
      .join(' · ');

    return new ReceiptScanError(
      summary ? `${detail} (${summary})` : detail,
      error.status,
      attempts
    );
  }
}
