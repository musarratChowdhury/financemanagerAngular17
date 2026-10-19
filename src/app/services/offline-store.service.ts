import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export interface QueuedWrite {
  id: string;
  method: string;
  url: string;
  body: any;
  headers: Record<string, string>;
  timestamp: number;
  userId: string;
}

export interface CachedResponse {
  id: string;
  url: string;
  response: any;
  timestamp: number;
  userId: string;
}

export interface EnvelopeBudgetRecord {
  id: string;
  userId: string;
  categoryId: number;
  month: number;
  year: number;
  limitAmount: number;
  updatedAt: number;
}

/**
 * IndexedDB wrapper for offline support.
 * Two stores, both scoped by user id:
 * - `queue`: pending writes (mutations) waiting for connectivity
 * - `cache`: last-known server reads for offline display
 */
@Injectable({ providedIn: 'root' })
export class OfflineStoreService {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'financemanager-offline';
  private readonly dbVersion = 2;
  private readonly queueStore = 'queue';
  private readonly cacheStore = 'cache';
  private readonly envelopeStore = 'envelopes';
  private initPromise: Promise<void> | null = null;

  constructor(private storage: StorageService) {}

  /** Initialize (or open) the database. Safe to call multiple times. */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;

        if (!database.objectStoreNames.contains(this.queueStore)) {
          const queueStore = database.createObjectStore(this.queueStore, { keyPath: 'id' });
          queueStore.createIndex('userId', 'userId', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!database.objectStoreNames.contains(this.cacheStore)) {
          const cacheStore = database.createObjectStore(this.cacheStore, { keyPath: 'id' });
          cacheStore.createIndex('userId', 'userId', { unique: false });
          cacheStore.createIndex('url', 'url', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!database.objectStoreNames.contains(this.envelopeStore)) {
          const envelopes = database.createObjectStore(this.envelopeStore, { keyPath: 'id' });
          envelopes.createIndex('userId', 'userId', { unique: false });
          envelopes.createIndex('period', ['userId', 'year', 'month'], { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });

    return this.initPromise;
  }

  /** Get the current user's ID from the JWT payload. */
  private getCurrentUserId(): string {
    const user = this.storage.getUser();
    if (typeof user === 'object') {
      return user?.id ?? user?.sub ?? user?.nameid ?? user?.userId ?? 'anonymous';
    }
    if (typeof user === 'string') {
      try {
        const encoded = user.split('.')[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(user.split('.')[1].length / 4) * 4, '=');
        const payload = JSON.parse(atob(encoded));
        return payload.sub ?? payload.nameid ?? payload.userId ?? 'anonymous';
      } catch {
        return 'anonymous';
      }
    }
    return 'anonymous';
  }

  /** Generate a unique ID for queue entries. */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  // ==================== QUEUE (pending writes) ====================

  /** Add a write operation to the queue. */
  async enqueueWrite(
    method: string,
    url: string,
    body: any,
    headers: Record<string, string> = {}
  ): Promise<string> {
    await this.init();
    const userId = this.getCurrentUserId();
    const id = this.generateId();

    const entry: QueuedWrite = {
      id,
      method,
      url,
      body,
      headers,
      timestamp: Date.now(),
      userId,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.queueStore, 'readwrite');
      tx.objectStore(this.queueStore).add(entry);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Get all queued writes for the current user, oldest first. */
  async getQueuedWrites(): Promise<QueuedWrite[]> {
    await this.init();
    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.queueStore, 'readonly');
      const index = tx.objectStore(this.queueStore).index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const results = request.result as QueuedWrite[];
        // Sort by timestamp ascending (oldest first)
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Remove a specific queued write by ID. */
  async removeQueuedWrite(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.queueStore, 'readwrite');
      tx.objectStore(this.queueStore).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Clear all queued writes for the current user. */
  async clearQueue(): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.queueStore, 'readwrite');
      const index = tx.objectStore(this.queueStore).index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Get count of pending writes for the current user. */
  async getQueueCount(): Promise<number> {
    await this.init();
    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.queueStore, 'readonly');
      const index = tx.objectStore(this.queueStore).index('userId');
      const request = index.count(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== CACHE (last-known reads) ====================

  /** Cache a GET response for offline use. */
  async cacheResponse(url: string, response: any): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();
    const id = `${userId}:${url}`;

    const entry: CachedResponse = {
      id,
      url,
      response,
      timestamp: Date.now(),
      userId,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.cacheStore, 'readwrite');
      tx.objectStore(this.cacheStore).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Get a cached response for a URL. */
  async getCachedResponse(url: string): Promise<any | null> {
    await this.init();
    const userId = this.getCurrentUserId();
    const id = `${userId}:${url}`;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.cacheStore, 'readonly');
      const request = tx.objectStore(this.cacheStore).get(id);

      request.onsuccess = () => {
        const result = request.result as CachedResponse | undefined;
        resolve(result?.response ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Clear all cached responses for the current user. */
  async clearCache(): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.cacheStore, 'readwrite');
      const index = tx.objectStore(this.cacheStore).index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Clear all data for the current user (queue + cache). Called on logout. */
  async clearUserData(): Promise<void> {
    await Promise.all([this.clearQueue(), this.clearCache(), this.clearEnvelopes()]);
  }

  async getEnvelopes(month: number, year: number): Promise<EnvelopeBudgetRecord[]> {
    await this.init();
    const userId = this.getCurrentUserId();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.envelopeStore, 'readonly');
      const request = tx.objectStore(this.envelopeStore).index('userId').getAll(userId);
      request.onsuccess = () =>
        resolve((request.result as EnvelopeBudgetRecord[]).filter((item) =>
          item.month === month && item.year === year
        ));
      request.onerror = () => reject(request.error);
    });
  }

  async saveEnvelope(categoryId: number, month: number, year: number, limitAmount: number): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();
    const entry: EnvelopeBudgetRecord = {
      id: `${userId}:${year}-${month}:${categoryId}`,
      userId,
      categoryId,
      month,
      year,
      limitAmount,
      updatedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.envelopeStore, 'readwrite');
      tx.objectStore(this.envelopeStore).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteEnvelope(categoryId: number, month: number, year: number): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.envelopeStore, 'readwrite');
      tx.objectStore(this.envelopeStore).delete(`${userId}:${year}-${month}:${categoryId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async clearEnvelopes(): Promise<void> {
    await this.init();
    const userId = this.getCurrentUserId();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.envelopeStore, 'readwrite');
      const request = tx.objectStore(this.envelopeStore).index('userId').openCursor(IDBKeyRange.only(userId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}