import {
  ref,
  get,
  set,
  update,
  onValue,
  serverTimestamp,
  Unsubscribe,
  runTransaction,
} from 'firebase/database';
import { signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseServices } from '../config/firebaseConfig';
import {
  AnswerKeyEntry,
  ExamResult,
  ExamSession,
  ExamSettings,
  StudentRecord,
} from '../types/exam';

/**
 * Pastikan sesi Firebase Auth tersedia jika rules membutuhkan `auth != null`.
 */
export async function ensureFirebaseAnonymousSession(): Promise<string | null> {
  const { configured, auth } = getFirebaseServices();
  if (!configured || !auth) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch {
    return null;
  }
}

export async function signInTeacherWithFirebaseEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; email?: string; uid?: string; error?: string }> {
  const { configured, auth } = getFirebaseServices();
  if (!configured || !auth) {
    return { ok: false, error: 'Firebase sekolah belum dikonfigurasi.' };
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, email: cred.user.email || email, uid: cred.user.uid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Login Firebase Auth gagal.',
    };
  }
}

export async function signOutFirebaseUser(): Promise<void> {
  const { configured, auth } = getFirebaseServices();
  if (!configured || !auth) return;
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}

/**
 * Memantau status koneksi aktual ke server Firebase Realtime Database via `.info/connected`.
 */
export function subscribeFirebaseConnection(callback: (connected: boolean) => void): Unsubscribe {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) {
    callback(false);
    return () => {};
  }
  const connRef = ref(db, '.info/connected');
  return onValue(
    connRef,
    (snap) => {
      callback(Boolean(snap.val()));
    },
    () => callback(false)
  );
}

/**
 * Uji tulis/baca ke Firebase untuk memverifikasi konfigurasi proyek sekolah.
 */
export async function testFirebaseConnection(): Promise<{ ok: boolean; message: string }> {
  const { configured, db, error } = getFirebaseServices();
  if (!configured || !db) {
    return { ok: false, message: error || 'Konfigurasi Firebase belum diisi.' };
  }
  try {
    const connectedSnap = await get(ref(db, '.info/connected'));
    await get(ref(db, 'exams'));
    return {
      ok: true,
      message: connectedSnap.val()
        ? 'Terhubung langsung ke Firebase Realtime Database sekolah.'
        : 'Konfigurasi valid; menunggu koneksi aktif ke Firebase Realtime Database.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gagal mengakses Firebase Realtime Database.',
    };
  }
}

export async function fbSaveStudents(students: StudentRecord[]): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');
  const map: Record<string, StudentRecord> = {};
  for (const s of students) {
    map[s.nis] = s;
  }
  await set(ref(db, 'students'), map);
}

export async function fbUpsertStudent(student: StudentRecord): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');
  await set(ref(db, `students/${student.nis}`), student);
}

export async function fbDeleteStudent(nis: string): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');
  await set(ref(db, `students/${nis}`), null);
}

export async function fbGetStudents(): Promise<StudentRecord[] | null> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return null;
  const snap = await get(ref(db, 'students'));
  if (!snap.exists()) return [];
  const val = snap.val() as Record<string, StudentRecord>;
  return Object.values(val);
}

export function fbSubscribeStudents(callback: (students: StudentRecord[]) => void): Unsubscribe {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return () => {};
  return onValue(ref(db, 'students'), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val() as Record<string, StudentRecord>;
    callback(Object.values(val));
  });
}

export async function fbSaveExamSettings(settings: ExamSettings): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');
  // Simpan pengaturan publik di exams/ dan token rahasia di examSecrets/
  const { token, ...publicSettings } = settings;
  await set(ref(db, `exams/${settings.examId}`), publicSettings);
  await update(ref(db, `examSecrets/${settings.examId}`), {
    token,
    updatedAt: serverTimestamp(),
  });
}

export async function fbSaveAnswerKeys(examId: string, keys: AnswerKeyEntry[]): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');
  const keyMap: Record<string, AnswerKeyEntry> = {};
  for (const k of keys) {
    keyMap[String(k.questionId)] = k;
  }
  await update(ref(db, `examSecrets/${examId}`), {
    answerKeys: keyMap,
    updatedAt: serverTimestamp(),
  });
}

export function fbSubscribeExamSettings(
  examId: string,
  callback: (settings: Partial<ExamSettings> | null) => void
): Unsubscribe {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return () => {};
  return onValue(ref(db, `exams/${examId}`), (snap) => {
    callback(snap.exists() ? (snap.val() as Partial<ExamSettings>) : null);
  });
}

/**
 * Sinkronisasi sesi ujian ke Firebase Realtime Database dengan proteksi konflik timestamp
 * dan larangan menimpa sesi yang sudah `submitted`.
 */
export async function fbUpsertSession(session: ExamSession): Promise<void> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');

  const sessionRef = ref(db, `sessions/${session.sessionId}`);
  const existing = await get(sessionRef);
  if (existing.exists()) {
    const serverSession = existing.val() as ExamSession;
    if (serverSession.status === 'submitted' && session.status !== 'submitted') {
      // Jangan pernah membuka kembali sesi yang sudah dikumpulkan
      return;
    }
    if ((serverSession.lastUpdatedAt || 0) > session.lastUpdatedAt) {
      // Data server lebih baru, jangan timpa dengan data lama
      return;
    }
  }

  await set(sessionRef, {
    ...session,
    serverSyncedAt: serverTimestamp(),
  });
}

export async function fbGetSession(sessionId: string): Promise<ExamSession | null> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return null;
  const snap = await get(ref(db, `sessions/${sessionId}`));
  return snap.exists() ? (snap.val() as ExamSession) : null;
}

export async function fbFindLatestSessionForStudent(
  nis: string,
  examId: string
): Promise<ExamSession | null> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return null;
  try {
    const snap = await get(ref(db, 'sessions'));
    if (!snap.exists()) return null;
    const all = Object.values(snap.val() as Record<string, ExamSession>);
    const matches = all
      .filter((s) => s.nis === nis && s.examId === examId)
      .sort((a, b) => (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0));
    return matches[0] || null;
  } catch {
    return null;
  }
}

export function fbSubscribeAllSessions(
  examId: string,
  callback: (sessions: ExamSession[]) => void
): Unsubscribe {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return () => {};
  return onValue(ref(db, 'sessions'), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const list = Object.values(snap.val() as Record<string, ExamSession>).filter(
      (s) => s.examId === examId
    );
    callback(list);
  });
}

/**
 * Pengumpulan hasil idempoten ke Firebase Realtime Database menggunakan runTransaction.
 * Memastikan `resultId` yang sama tidak membuat entri ganda atau menimpa hasil yang sudah sah.
 */
export async function fbSubmitResultIdempotent(
  result: ExamResult,
  session: ExamSession
): Promise<{ saved: boolean; idempotent: boolean; finalResult: ExamResult }> {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) throw new Error('Firebase belum dikonfigurasi.');

  const resultRef = ref(db, `results/${result.resultId}`);
  const payloadToStore: ExamResult = {
    ...result,
    statusSinkronisasi: 'synced',
  };

  const txResult = await runTransaction(resultRef, (current) => {
    if (current !== null) {
      // Sudah ada hasil sah dengan resultId ini -> jangan timpa
      return current;
    }
    return {
      ...payloadToStore,
      serverSubmittedAt: serverTimestamp(),
    };
  });

  // Kunci sesi di Firebase agar tidak dapat diubah/dilanjutkan
  await update(ref(db, `sessions/${session.sessionId}`), {
    status: 'submitted',
    submittedAt: session.submittedAt || Date.now(),
    resultId: result.resultId,
    lastUpdatedAt: Date.now(),
    jawaban: session.jawaban,
    pelanggaranTab: session.pelanggaranTab,
    sanksiTingkatTertinggi: session.sanksiTingkatTertinggi,
  });

  const committedVal = (txResult.snapshot.val() as ExamResult) || payloadToStore;
  return {
    saved: true,
    idempotent: !txResult.committed,
    finalResult: committedVal,
  };
}

export function fbSubscribeAllResults(
  examId: string,
  callback: (results: ExamResult[]) => void
): Unsubscribe {
  const { configured, db } = getFirebaseServices();
  if (!configured || !db) return () => {};
  return onValue(ref(db, 'results'), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const list = Object.values(snap.val() as Record<string, ExamResult>).filter(
      (r) => r.examId === examId
    );
    callback(list);
  });
}
