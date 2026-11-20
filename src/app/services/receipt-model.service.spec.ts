import { TestBed } from '@angular/core/testing';
import { ReceiptModelService } from './receipt-model.service';
import {
  GeminiModelsResponse,
  GeminiProbeResponse,
  ReceiptScannerService,
} from './receipt-scanner.service';
import { SettingsService } from './settings.service';

/** In-memory stand-in for the account-wide settings API. */
class SettingsStub {
  readonly values = new Map<string, string>();
  failWrites = false;

  async getString(key: string): Promise<string | null> {
    const stored = this.values.get(key);
    return stored === undefined ? null : (JSON.parse(stored) as string);
  }

  async setString(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('API unavailable');
    this.values.set(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

/** Stub of the API client, so the service's rules can be tested without HTTP. */
class ScannerStub {
  lastProbeModels: string[] | null = null;
  lastProbeFresh = false;

  catalogue: GeminiModelsResponse = {
    models: [
      model('gemma-4-26b-a4b-it'),
      model('gemini-3.8-flash'),
      model('text-embedding-004', false),
    ],
    defaultModel: 'gemma-4-26b-a4b-it',
    keyConfigured: true,
    attemptTimeoutSeconds: 10,
    checkedAt: '2026-10-25T07:00:00Z',
  };

  probeResult: GeminiProbeResponse = {
    winner: 'gemma-4-26b-a4b-it',
    results: [
      {
        model: 'gemma-4-26b-a4b-it',
        outcome: 'ok',
        retryable: false,
        httpStatus: 200,
        errorStatus: null,
        elapsedMs: 9000,
        message: null,
        suggestedModel: null,
        rawResponse: null,
      },
      {
        model: 'text-embedding-004',
        outcome: 'no_generate_content',
        retryable: false,
        httpStatus: null,
        errorStatus: null,
        elapsedMs: 0,
        message: 'This model does not support generateContent.',
        suggestedModel: null,
        rawResponse: null,
      },
    ],
    keyConfigured: true,
    probeMode: 'receipt',
    cached: false,
    checkedAt: '2026-10-25T07:00:00Z',
  };

  async listModels(): Promise<GeminiModelsResponse> {
    return this.catalogue;
  }

  async probe(models?: string[], fresh = false): Promise<GeminiProbeResponse> {
    this.lastProbeModels = models ?? null;
    this.lastProbeFresh = fresh;
    return this.probeResult;
  }
}

function model(name: string, generateContent = true) {
  return {
    name,
    version: 'v1beta',
    displayName: name,
    description: null,
    inputTokenLimit: 1000,
    outputTokenLimit: 1000,
    supportedGenerationMethods: generateContent ? ['generateContent'] : ['embedContent'],
    supportsGenerateContent: generateContent,
  };
}

describe('ReceiptModelService', () => {
  let service: ReceiptModelService;
  let scanner: ScannerStub;
  let settings: SettingsStub;

  beforeEach(() => {
    localStorage.clear();
    scanner = new ScannerStub();
    settings = new SettingsStub();

    TestBed.configureTestingModule({
      providers: [
        ReceiptModelService,
        { provide: ReceiptScannerService, useValue: scanner },
        { provide: SettingsService, useValue: settings },
      ],
    });

    service = TestBed.inject(ReceiptModelService);
  });

  afterEach(() => localStorage.clear());

  it('starts with no saved model so the server default applies', () => {
    expect(service.model()).toBeNull();
    expect(service.saved()).toBeNull();
  });

  it('stores a manual choice with its source', () => {
    service.saveManual('gemini-3.8-flash');

    expect(service.model()).toBe('gemini-3.8-flash');
    expect(service.saved()?.source).toBe('manual');

    const stored = JSON.parse(localStorage.getItem('syp-receipt-model') ?? '{}');
    expect(stored.model).toBe('gemini-3.8-flash');
  });

  it('never lets the sweep overwrite a manual choice', async () => {
    service.saveManual('gemma-4-26b-a4b-it');
    scanner.probeResult = { ...scanner.probeResult, winner: 'gemini-3.8-flash' };

    await service.runSweep(true);

    expect(service.sweep().winner).toBe('gemini-3.8-flash');
    expect(service.saved()?.model).toBe('gemma-4-26b-a4b-it');
    expect(service.saved()?.source).toBe('manual');
  });

  it('adopts the sweep winner when the choice was automatic', async () => {
    expect(service.saveAuto('gemma-4-26b-a4b-it')).toBeTrue();
    scanner.probeResult = { ...scanner.probeResult, winner: 'gemini-3.8-flash' };

    await service.runSweep(true);

    expect(service.saved()?.model).toBe('gemini-3.8-flash');
    expect(service.saved()?.source).toBe('auto');
  });

  it('adopts the sweep winner when nothing is saved yet', async () => {
    scanner.probeResult = { ...scanner.probeResult, winner: 'gemini-3.8-flash' };

    await service.runSweep();

    expect(service.saved()?.model).toBe('gemini-3.8-flash');
    expect(service.saved()?.source).toBe('auto');
  });

  it('tries the saved model first, then the server default', async () => {
    service.saveManual('gemini-3.8-flash');

    await service.runSweep(true);

    expect(scanner.lastProbeModels).toEqual([
      'gemini-3.8-flash',
      'gemma-4-26b-a4b-it',
    ]);
    expect(scanner.lastProbeFresh).toBeTrue();
  });

  it('leaves the embedded model out of the sweep', async () => {
    await service.runSweep();

    expect(scanner.lastProbeModels).not.toContain('text-embedding-004');
  });

  it('tries models with a known-good verdict before untested ones', async () => {
    scanner.catalogue = {
      ...scanner.catalogue,
      models: [
        model('gemma-4-26b-a4b-it'),
        model('alpha-model'),
        model('gemini-3.8-flash'),
      ],
    };
    service.recordTest({
      model: 'gemini-3.8-flash',
      outcome: 'ok',
      at: '2026-10-25T06:00:00Z',
      httpStatus: 200,
      message: null,
      rawResponse: null,
    });

    await service.runSweep();

    expect(scanner.lastProbeModels).toEqual([
      'gemma-4-26b-a4b-it',
      'gemini-3.8-flash',
      'alpha-model',
    ]);
  });

  it('caps a sweep so a large catalogue cannot spend a request per model', async () => {
    scanner.catalogue = {
      ...scanner.catalogue,
      models: Array.from({ length: 20 }, (_, index) => model(`model-${index}`)),
    };

    await service.runSweep();

    expect(scanner.lastProbeModels?.length).toBe(12);
  });

  it('records every verdict and exposes the unusable models', async () => {
    await service.runSweep();

    const tests = service.tests();
    expect(tests['gemma-4-26b-a4b-it'].outcome).toBe('ok');
    expect(tests['text-embedding-004'].outcome).toBe('no_generate_content');
    expect(service.unavailable().has('text-embedding-004')).toBeTrue();
    expect(service.unavailable().has('gemma-4-26b-a4b-it')).toBeFalse();
  });

  it('reports a missing server key without probing', async () => {
    scanner.catalogue = { ...scanner.catalogue, keyConfigured: false };

    await service.runSweep(true);

    expect(service.sweep().status).toBe('error');
    expect(service.sweep().message).toContain('GEMINI_API_KEY');
    expect(scanner.lastProbeModels).toBeNull();
  });

  it('stands down while a scan is in flight', async () => {
    service.scanInProgress.set(true);

    await service.runSweep(true);

    expect(service.sweep().status).toBe('idle');
    expect(scanner.lastProbeModels).toBeNull();
  });

  it('clears the choice so the server default applies again', async () => {
    await service.saveManual('gemini-3.8-flash');
    await service.clear();

    expect(service.model()).toBeNull();
    expect(localStorage.getItem('syp-receipt-model')).toBeNull();
    expect(settings.values.size).toBe(0);
  });

  /* ------------------------------------------------------- account storage */

  it('writes a manual choice to the account setting', async () => {
    await service.saveManual('gemini-3.8-flash');

    expect(await settings.getString('ReceiptScanModel')).toBe('gemini-3.8-flash');
  });

  it('restores the account choice after a reload and treats it as manual', async () => {
    settings.values.set('ReceiptScanModel', JSON.stringify('gemini-3.8-flash'));

    const adopted = await service.loadFromServer();

    expect(adopted).toBe('gemini-3.8-flash');
    expect(service.model()).toBe('gemini-3.8-flash');
    expect(service.saved()?.source).toBe('manual');
  });

  it('keeps the cached choice when the settings API is unreachable', async () => {
    const original = settings.getString;
    settings.getString = async () => {
      throw new Error('offline');
    };

    const adopted = await service.loadFromServer();

    expect(adopted).toBeNull();
    settings.getString = original;
  });

  it('does not let the sweep overwrite the account choice', async () => {
    settings.values.set('ReceiptScanModel', JSON.stringify('gemma-4-26b-a4b-it'));
    await service.loadFromServer();
    scanner.probeResult = { ...scanner.probeResult, winner: 'gemini-3.8-flash' };

    await service.runSweep(true);

    expect(service.model()).toBe('gemma-4-26b-a4b-it');
    expect(await settings.getString('ReceiptScanModel')).toBe('gemma-4-26b-a4b-it');
  });

  it('keeps an automatic winner local, so it cannot overwrite another device', async () => {
    scanner.probeResult = { ...scanner.probeResult, winner: 'gemini-3.8-flash' };

    await service.runSweep();

    expect(service.saved()?.model).toBe('gemini-3.8-flash');
    expect(service.saved()?.source).toBe('auto');
    expect(settings.values.size).toBe(0);
  });

  it('rejects when the account write fails, but keeps the local choice', async () => {
    settings.failWrites = true;

    await expectAsync(service.saveManual('gemini-3.8-flash')).toBeRejected();

    expect(service.model()).toBe('gemini-3.8-flash');
  });
});
