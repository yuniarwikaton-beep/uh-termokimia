import { ExamResult, ExamSession, SyncQueueItem } from '../types/exam';
import { STORAGE_KEYS } from './defaults';

const IDB_NAME = 'cbt_kimia_offline_db';
const IDB_VERSION = 1;
const STORE_QUEUE = 'syncQueue';
const STORE_SESSIONS = 'sessions';
const STORE_RESULTS = 'results';

const FALLBACK_QUEUE_LS_KEY = 'cbt_kimia_sync_queue_fallback_v1';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'operationId' });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        db.createObjectStore(STORE_RESULTS, { keyPath: 'resultId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB.'));
  });
}

export function generateUniqueId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function enqueueSyncOperation(item: SyncQueueItem): Promise<void> {
  // Mirror to LocalStorage first for instant sync safety
  try {
    const existing = getFallbackQueue();
    // Deduplicate excessive session_update items for the same sessionId (keep latest payload)
    const filtered =
      item.type === 'session_update'
        ? existing.filter((q) => !(q.type === 'session_update' && q.sessionId === item.sessionId))
        : existing.filter((q) => q.operationId !== item.operationId);
    filtered.push(item);
    localStorage.setItem(FALLBACK_QUEUE_LS_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage quota warning here; IndexedDB handles larger payloads
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      if (item.type === 'session_update') {
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const all = (getAllReq.result || []) as SyncQueueItem[];
          for (const old of all) {
            if (old.type === 'session_update' && old.sessionId === item.sessionId) {
              store.delete(old.operationId);
            }
          }
          store.put(item);
        };
      } else {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // LocalStorage fallback already holds the queue item
  }
}

function getFallbackQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(FALLBACK_QUEUE_LS_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

export async function getPendingSyncOperations(): Promise<SyncQueueItem[]> {
  try {
    const db = await openIDB();
    const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result || []) as SyncQueueItem[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return getFallbackQueue().sort((a, b) => a.timestamp - b.timestamp);
  }
}

export async function removeSyncOperation(operationId: string): Promise<void> {
  try {
    const existing = getFallbackQueue().filter((q) => q.operationId !== operationId);
    localStorage.setItem(FALLBACK_QUEUE_LS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).delete(operationId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function updateSyncOperationError(operationId: string, errorMsg: string): Promise<void> {
  try {
    const existing = getFallbackQueue().map((q) =>
      q.operationId === operationId ? { ...q, retryCount: q.retryCount + 1, lastError: errorMsg } : q
    );
    localStorage.setItem(FALLBACK_QUEUE_LS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.get(operationId);
      req.onsuccess = () => {
        const item = req.result as SyncQueueItem | undefined;
        if (item) {
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastError = errorMsg;
          store.put(item);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function saveLocalSessionRecord(session: ExamSession): Promise<void> {
  try {
    localStorage.setItem(`${STORAGE_KEYS.SESSION_PREFIX}${session.sessionId}`, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, session.sessionId);
  } catch {
    // ignore
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function saveLocalResultRecord(result: ExamResult): Promise<void> {
  try {
    localStorage.setItem(`${STORAGE_KEYS.RESULT_PREFIX}${result.resultId}`, JSON.stringify(result));
  } catch {
    // ignore
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      tx.objectStore(STORE_RESULTS).put(result);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export function getAllLocalSessions(): ExamSession[] {
  const sessions: ExamSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.SESSION_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          sessions.push(JSON.parse(raw) as ExamSession);
        }
      }
    }
  } catch {
    // ignore
  }
  return sessions.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
}

export function getAllLocalResults(): ExamResult[] {
  const results: ExamResult[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.RESULT_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          results.push(JSON.parse(raw) as ExamResult);
        }
      }
    }
  } catch {
    // ignore
  }
  return results.sort((a, b) => b.waktuPengumpulan - a.waktuPengumpulan);
}

export function findLatestSessionForStudent(nis: string, examId: string): ExamSession | null {
  const sessions = getAllLocalSessions().filter((s) => s.nis === nis && s.examId === examId);
  return sessions.length > 0 ? sessions[0] : null;
}

export function findResultBySessionId(sessionId: string): ExamResult | null {
  const results = getAllLocalResults();
  return results.find((r) => r.sessionId === sessionId) || null;
}
