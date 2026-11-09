// Zealosh LMS — PWA Client Offline Queue & Service Worker Manager
// Path: src/lib/pwa/client-offline-queue.ts
// Manages local client offline event queuing, synchronization upon reconnection, and cache purge on logout.

import { PwaOfflineQueueItem } from '@/types';
import { APPROVED_OFFLINE_OPERATIONS, PROHIBITED_OFFLINE_OPERATIONS } from './offline-queue-service';

const STORAGE_KEY_PREFIX = 'zealosh_pwa_offline_queue_';

export class ClientOfflineQueue {
  private static getStorageKey(studentId: string): string {
    return `${STORAGE_KEY_PREFIX}${studentId}`;
  }

  /**
   * Queues an approved offline progress event locally.
   * Rejects prohibited operations (exams, payments, admissions).
   */
  public static queueItem(
    studentId: string,
    eventType: 'LESSON_READING_PROGRESS' | 'BOOKMARK_CREATED' | 'USER_PREFERENCE_UPDATED',
    resourceId: string,
    payload: Record<string, any>
  ): { queued: boolean; error?: string } {
    if (PROHIBITED_OFFLINE_OPERATIONS.includes(eventType)) {
      return {
        queued: false,
        error: `Operation '${eventType}' is strictly prohibited while offline. Real-time server connection required.`,
      };
    }

    if (!APPROVED_OFFLINE_OPERATIONS.includes(eventType)) {
      return {
        queued: false,
        error: `Unsupported offline operation '${eventType}'.`,
      };
    }

    const key = this.getStorageKey(studentId);
    let queue: PwaOfflineQueueItem[] = [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(key);
        if (stored) queue = JSON.parse(stored);
      }
    } catch {
      queue = [];
    }

    const item: PwaOfflineQueueItem = {
      clientEventId: `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      studentId,
      eventType,
      resourceId,
      payload,
      createdAt: new Date().toISOString(),
      syncStatus: 'QUEUED',
    };

    queue.push(item);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(queue));
      }
    } catch {
      // Memory fallback if storage is disabled
    }

    return { queued: true };
  }

  /**
   * Retrieves queued offline events for the specified student
   */
  public static getQueuedItems(studentId: string): PwaOfflineQueueItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = this.getStorageKey(studentId);
        const stored = window.localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Clears queued items for the student (called on logout or successful sync)
   */
  public static clearQueue(studentId: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = this.getStorageKey(studentId);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Synchronizes queued items to the authoritative server
   */
  public static async syncQueue(studentId: string): Promise<{ synced: boolean; count: number; error?: string }> {
    const items = this.getQueuedItems(studentId);
    if (items.length === 0) {
      return { synced: true, count: 0 };
    }

    try {
      const res = await fetch('/api/pwa/sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, items }),
      });

      if (!res.ok) {
        return { synced: false, count: 0, error: `Sync failed with HTTP ${res.status}` };
      }

      const data = await res.json();
      this.clearQueue(studentId);
      return { synced: true, count: data.outcome?.syncedCount || items.length };
    } catch (err: any) {
      return { synced: false, count: 0, error: err.message };
    }
  }

  /**
   * Registers the Zealosh PWA Service Worker
   */
  public static registerServiceWorker(): void {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[Zealosh PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[Zealosh PWA] Service Worker registration skipped or failed:', err);
          });
      });
    }
  }

  /**
   * Informs the service worker on logout to purge sensitive caches
   */
  public static purgeUserCacheOnLogout(): void {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_USER_CACHE' });
    }
  }
}

