import { isFirebaseConfigured } from '../config/firebaseConfig';
import { ExamResult, ExamSession, SyncStatusType } from '../types/exam';
import {
  ensureFirebaseAnonymousSession,
  fbSubmitResultIdempotent,
  fbUpsertSession,
} from './firebaseDb';
import {
  enqueueSyncOperation,
  generateUniqueId,
  getPendingSyncOperations,
  removeSyncOperation,
  saveLocalResultRecord,
  saveLocalSessionRecord,
  updateSyncOperationError,
} from './offlineQueue';

export interface SyncOutcome {
  syncStatus: SyncStatusType;
  resultSyncStatus: 'synced' | 'pending' | 'failed';
  errorMessage?: string;
}

/**
 * Menyimpan sesi ujian secara lokal terlebih dahulu (LocalStorage + IndexedDB),
 * lalu mengirim ke Firebase Realtime Database jika online & Firebase terkonfigurasi.
 * Jika offline atau Firebase gagal, memasukkan operasi ke antrean sinkronisasi eksplisit.
 */
export async function persistAndSyncSession(
  session: ExamSession,
  isOnline: boolean,
  isFirebaseConnected: boolean
): Promise<SyncOutcome> {
  // 1. Selalu simpan ke LocalStorage + IndexedDB terlebih dahulu agar tidak pernah hilang
  await saveLocalSessionRecord(session);

  const firebaseReady = isFirebaseConfigured();

  if (!isOnline || !firebaseReady || !isFirebaseConnected) {
    await enqueueSyncOperation({
      operationId: generateUniqueId('op_sess'),
      type: 'session_update',
      sessionId: session.sessionId,
      examId: session.examId,
      nis: session.nis,
      timestamp: session.lastUpdatedAt,
      payload: session,
      retryCount: 0,
    });
    return {
      syncStatus: !isOnline ? 'offline_local' : 'pending_sync',
      resultSyncStatus: 'pending',
    };
  }

  try {
    await ensureFirebaseAnonymousSession();
    await fbUpsertSession(session);
    return {
      syncStatus: 'online_synced',
      resultSyncStatus: 'synced',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan sesi ke Firebase.';
    await enqueueSyncOperation({
      operationId: generateUniqueId('op_sess'),
      type: 'session_update',
      sessionId: session.sessionId,
      examId: session.examId,
      nis: session.nis,
      timestamp: session.lastUpdatedAt,
      payload: session,
      retryCount: 1,
      lastError: msg,
    });
    return {
      syncStatus: 'sync_failed',
      resultSyncStatus: 'failed',
      errorMessage: msg,
    };
  }
}

/**
 * Mengumpulkan hasil ujian secara online maupun offline.
 * Jika offline atau Firebase belum tersambung, hasil disimpan di perangkat dengan status 'pending'
 * dan dimasukkan ke antrean sinkronisasi lokal untuk dikirim otomatis saat internet kembali.
 */
export async function submitAndSyncExamResult(
  result: ExamResult,
  session: ExamSession,
  isOnline: boolean,
  isFirebaseConnected: boolean
): Promise<{ finalResult: ExamResult; syncStatus: SyncStatusType; errorMessage?: string }> {
  const lockedSession: ExamSession = {
    ...session,
    status: 'submitted',
    submittedAt: result.waktuPengumpulan,
    resultId: result.resultId,
    lastUpdatedAt: result.waktuPengumpulan,
  };

  // Simpan sesi terkunci & hasil lokal terlebih dahulu
  await saveLocalSessionRecord(lockedSession);

  const firebaseReady = isFirebaseConfigured();

  if (!isOnline || !firebaseReady || !isFirebaseConnected) {
    const offlineResult: ExamResult = {
      ...result,
      statusSinkronisasi: 'pending',
    };
    await saveLocalResultRecord(offlineResult);
    await enqueueSyncOperation({
      operationId: generateUniqueId('op_submit'),
      type: 'result_submit',
      sessionId: lockedSession.sessionId,
      resultId: result.resultId,
      examId: result.examId,
      nis: result.nis,
      timestamp: result.waktuPengumpulan,
      payload: { result: offlineResult, session: lockedSession },
      retryCount: 0,
    });

    return {
      finalResult: offlineResult,
      syncStatus: !isOnline ? 'offline_local' : 'pending_sync',
    };
  }

  try {
    await ensureFirebaseAnonymousSession();
    const { finalResult } = await fbSubmitResultIdempotent(result, lockedSession);
    const syncedRecord: ExamResult = {
      ...finalResult,
      statusSinkronisasi: 'synced',
    };
    await saveLocalResultRecord(syncedRecord);
    return {
      finalResult: syncedRecord,
      syncStatus: 'online_synced',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim hasil ke Firebase.';
    const failedLocalResult: ExamResult = {
      ...result,
      statusSinkronisasi: 'failed',
      syncError: msg,
    };
    await saveLocalResultRecord(failedLocalResult);
    await enqueueSyncOperation({
      operationId: generateUniqueId('op_submit'),
      type: 'result_submit',
      sessionId: lockedSession.sessionId,
      resultId: result.resultId,
      examId: result.examId,
      nis: result.nis,
      timestamp: result.waktuPengumpulan,
      payload: { result: failedLocalResult, session: lockedSession },
      retryCount: 1,
      lastError: msg,
    });
    return {
      finalResult: failedLocalResult,
      syncStatus: 'sync_failed',
      errorMessage: msg,
    };
  }
}

/**
 * Mengirim seluruh antrean sinkronisasi lokal secara berurutan (FIFO) ketika koneksi & Firebase aktif.
 */
export async function flushOfflineSyncQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  lastError?: string;
}> {
  if (!isFirebaseConfigured() || !navigator.onLine) {
    const pending = await getPendingSyncOperations();
    return { processed: 0, succeeded: 0, failed: 0, remaining: pending.length };
  }

  const queue = await getPendingSyncOperations();
  if (queue.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };
  }

  await ensureFirebaseAnonymousSession();

  let succeeded = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const op of queue) {
    try {
      if (op.type === 'session_update') {
        const sess = op.payload as ExamSession;
        await fbUpsertSession(sess);
        await removeSyncOperation(op.operationId);
        succeeded += 1;
      } else if (op.type === 'result_submit') {
        const { result, session } = op.payload as { result: ExamResult; session: ExamSession };
        const { finalResult } = await fbSubmitResultIdempotent(result, session);
        await saveLocalResultRecord({ ...finalResult, statusSinkronisasi: 'synced', syncError: undefined });
        await removeSyncOperation(op.operationId);
        succeeded += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sinkronisasi tertunda.';
      lastError = msg;
      await updateSyncOperationError(op.operationId, msg);
      failed += 1;
    }
  }

  const remainingList = await getPendingSyncOperations();
  return {
    processed: queue.length,
    succeeded,
    failed,
    remaining: remainingList.length,
    lastError,
  };
}
