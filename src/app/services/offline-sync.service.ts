import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { OfflineStoreService, QueuedWrite } from './offline-store.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly http = inject(HttpClient);
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineStore = inject(OfflineStoreService);
  private readonly storage = inject(StorageService);

  private isSyncing = false;
  private syncListeners = new Set<() => void>();

  /** Subscribe to sync state changes. */
  onSyncChange(listener: () => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private notifyListeners(): void {
    this.syncListeners.forEach((l) => l());
  }

  /** Check if a sync is currently in progress. */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /** Manually trigger a sync. Returns true if sync ran, false if already syncing or offline. */
  async syncNow(): Promise<boolean> {
    if (this.isSyncing) return false;
    if (!this.connectivity.isOnline()) return false;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      await this.drainQueue();
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return true;
  }

  /** Called automatically when connectivity is restored. */
  async onOnline(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.connectivity.isOnline()) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      await this.drainQueue();
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /** Process the queue in order. Each write is sent; on success it's removed.
   * On failure (network error), stop and leave remaining items for next attempt. */
  private async drainQueue(): Promise<void> {
    const queue = await this.offlineStore.getQueuedWrites();
    if (queue.length === 0) return;

    for (const item of queue) {
      // Re-check connectivity before each request
      if (!this.connectivity.isOnline()) {
        console.log('[OfflineSync] Went offline mid-sync, stopping');
        break;
      }

      try {
        await this.replayWrite(item);
        await this.offlineStore.removeQueuedWrite(item.id);
      } catch (error) {
        // Only stop on network errors; 4xx/5xx means server responded
        // so we remove the item to avoid infinite retries
        const isNetworkError =
          error instanceof TypeError || // fetch network error
          (error instanceof Error && error.name === 'NetworkError') ||
          (error as any)?.status === 0;

        if (isNetworkError) {
          console.log('[OfflineSync] Network error, stopping sync:', error);
          break;
        }

        // Server responded with error (4xx/5xx) - remove from queue but log
        console.warn('[OfflineSync] Server error, removing from queue:', error);
        await this.offlineStore.removeQueuedWrite(item.id);
      }
    }

    // After draining, refresh cached reads that might be stale
    await this.refreshCachedReads();
  }

  /** Replay a single queued write to the server. */
  private async replayWrite(item: QueuedWrite): Promise<any> {
    const authToken = this.storage.getUser();

    const response = await firstValueFrom(
      this.http.request(item.method, item.url, {
        body: item.body,
        headers: {
          ...item.headers,
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      })
    );

    return response;
  }

  /** After successful sync, re-fetch key endpoints to update cache. */
  private async refreshCachedReads(): Promise<void> {
    const endpointsToRefresh = [
      '/api/Expense/GetExpensesOfThisMonth',
      '/api/Income/GetIncomeOfThisMonth',
      '/api/Dashboard/GetDashboardData',
      '/api/ExpenseCategory/GetAllExpenseCategories',
      '/api/IncomeCategory/GetAllIncomeCategories',
    ];

    const authToken = this.storage.getUser();

    for (const url of endpointsToRefresh) {
      if (!this.connectivity.isOnline()) break;

      try {
        const response = await firstValueFrom(
          this.http.get(url, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
        );
        await this.offlineStore.cacheResponse(url, response);
      } catch (error) {
        // Ignore individual refresh failures
        console.warn(`[OfflineSync] Failed to refresh ${url}:`, error);
      }
    }
  }
}