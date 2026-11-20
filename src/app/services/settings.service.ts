import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** One stored setting, as the API returns it. */
export interface SettingDto {
  key: string;
  /** Raw value as stored — a JSON string, e.g. `"gemini-2.5-flash"`. */
  value: string;
  description: string | null;
}

/** Setting keys the app knows about. Must match `SettingKeys` in the API. */
export const SETTING_KEYS = {
  receiptScanModel: 'ReceiptScanModel',
} as const;

/**
 * Account-wide application settings, stored server-side.
 *
 * Values are JSON strings server-side, so `getString` / `setString` take care of
 * the quoting and a caller never has to think about it.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/Settings`;

  async getAll(): Promise<SettingDto[]> {
    return firstValueFrom(this.http.get<SettingDto[]>(this.base));
  }

  /** One setting, or null when it has never been set. */
  async get(key: string): Promise<SettingDto | null> {
    try {
      return await firstValueFrom(this.http.get<SettingDto>(`${this.base}/${key}`));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async set(key: string, value: string, description?: string | null): Promise<SettingDto> {
    return firstValueFrom(
      this.http.put<SettingDto>(`${this.base}/${key}`, { value, description: description ?? null })
    );
  }

  /** Removes the setting, so the server's configured default applies again. */
  async remove(key: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.base}/${key}`));
    } catch (error) {
      // Already gone is the state the caller wanted.
      if (!isNotFound(error)) throw error;
    }
  }

  /** A setting's value as a plain string (unquoted), or null when unset. */
  async getString(key: string): Promise<string | null> {
    const setting = await this.get(key);
    return setting ? parseStringValue(setting.value) : null;
  }

  /** Stores a plain string, JSON-quoted for the server. */
  async setString(key: string, value: string): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }
}

/** Accepts both the quoted (`"x"`) and bare (`x`) forms. */
function parseStringValue(value: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('"')) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
