import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, GraduationCap, WifiOff } from 'lucide-react';
import { ExamView } from './components/ExamView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ResultView } from './components/ResultView';
import { StudentLoginView } from './components/StudentLoginView';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { TeacherDashboard } from './components/TeacherDashboard';
import { DEFAULT_ANSWER_KEYS } from './config/answerKeys';
import { isFirebaseConfigured } from './config/firebaseConfig';
import { QUESTIONS_DATA } from './data/questions';
import { getSavedTeacherAuth, saveTeacherAuth, TeacherSessionAuth } from './services/authService';
import {
  DEFAULT_EXAM_SETTINGS,
  INITIAL_STUDENTS,
  STORAGE_KEYS,
} from './services/defaults';
import {
  fbFindLatestSessionForStudent,
  fbGetStudents,
  fbSaveAnswerKeys,
  fbSaveExamSettings,
  fbSaveStudents,
  fbSubscribeAllResults,
  fbSubscribeAllSessions,
  fbSubscribeExamSettings,
  fbSubscribeStudents,
  subscribeFirebaseConnection,
} from './services/firebaseDb';
import {
  findLatestSessionForStudent,
  findResultBySessionId,
  generateUniqueId,
  getAllLocalResults,
  getAllLocalSessions,
  getPendingSyncOperations,
  saveLocalResultRecord,
  saveLocalSessionRecord,
} from './services/offlineQueue';
import { calculateExamResult, fisherYatesShuffle } from './services/scoring';
import {
  flushOfflineSyncQueue,
  persistAndSyncSession,
  submitAndSyncExamResult,
} from './services/sync';
import {
  AnswerKeyEntry,
  ExamResult,
  ExamSession,
  ExamSettings,
  StudentRecord,
  SyncStatusType,
} from './types/exam';

type AppRoute = 'student_login' | 'exam' | 'result' | 'teacher';

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>('student_login');

  // Shared configuration & roster state
  const [settings, setSettings] = useState<ExamSettings>(() =>
    loadFromLS<ExamSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_EXAM_SETTINGS)
  );
  const [students, setStudents] = useState<StudentRecord[]>(() =>
    loadFromLS<StudentRecord[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS)
  );
  const [answerKeys, setAnswerKeys] = useState<AnswerKeyEntry[]>(() =>
    loadFromLS<AnswerKeyEntry[]>(STORAGE_KEYS.ANSWER_KEYS, DEFAULT_ANSWER_KEYS)
  );

  // Connectivity & Firebase state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [firebaseVersion, setFirebaseVersion] = useState(0);
  const [firebaseConfigured, setFirebaseConfigured] = useState<boolean>(() =>
    isFirebaseConfigured()
  );
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_local' : 'offline_local'
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Toast notification
  const [toast, setToast] = useState<{
    id: number;
    tone: 'info' | 'warning' | 'success';
    message: string;
  } | null>(null);

  const showToast = useCallback((tone: 'info' | 'warning' | 'success', message: string) => {
    const id = Date.now();
    setToast({ id, tone, message });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 5500);
  }, []);

  // Exam & Result active state
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);
  const [activeResult, setActiveResult] = useState<ExamResult | null>(null);
  const [reloadResumePrompt, setReloadResumePrompt] = useState<ExamSession | null>(null);
  const [reloadResumeShowInfo, setReloadResumeShowInfo] = useState(false);

  // Teacher Auth & Live Firebase Monitoring Data
  const [teacherAuth, setTeacherAuth] = useState<TeacherSessionAuth | null>(() =>
    getSavedTeacherAuth()
  );
  const [remoteSessions, setRemoteSessions] = useState<ExamSession[]>([]);
  const [remoteResults, setRemoteResults] = useState<ExamResult[]>([]);
  const [localSessions, setLocalSessions] = useState<ExamSession[]>(() => getAllLocalSessions());
  const [localResults, setLocalResults] = useState<ExamResult[]>(() => getAllLocalResults());

  const syncDebounceRef = useRef<number | null>(null);

  const refreshLocalStores = useCallback(async () => {
    setLocalSessions(getAllLocalSessions());
    setLocalResults(getAllLocalResults());
    const pending = await getPendingSyncOperations();
    setPendingCount(pending.length);
    return pending.length;
  }, []);

  // Cek sesi aktif yang belum selesai saat halaman dimuat ulang / Chromebook restart
  useEffect(() => {
    const lastSessionId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    if (lastSessionId) {
      const raw = localStorage.getItem(`${STORAGE_KEYS.SESSION_PREFIX}${lastSessionId}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ExamSession;
          if (parsed && parsed.status !== 'submitted') {
            setReloadResumePrompt(parsed);
          }
        } catch {
          // ignore corrupted entry
        }
      }
    }
    refreshLocalStores();
  }, [refreshLocalStores]);

  // Monitor Online / Offline + Flush Queue Otomatis saat Internet Kembali
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('success', 'Koneksi internet tersambung kembali. Data siap disinkronkan.');
      if (isFirebaseConfigured()) {
        const res = await flushOfflineSyncQueue();
        await refreshLocalStores();
        if (res.succeeded > 0) {
          setSyncStatus('online_synced');
          showToast(
            'success',
            `${res.succeeded} data antrean offline berhasil disinkronkan ke Firebase.`
          );
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsFirebaseConnected(false);
      setSyncStatus('offline_local');
      showToast('warning', 'Koneksi internet terputus. Jawaban tetap tersimpan di perangkat.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshLocalStores, showToast]);

  // Subscribe Firebase connection & real-time listeners
  useEffect(() => {
    const configured = isFirebaseConfigured();
    setFirebaseConfigured(configured);
    if (!configured) {
      setIsFirebaseConnected(false);
      setSyncStatus('offline_local');
      return;
    }

    const unsubConn = subscribeFirebaseConnection(async (connected) => {
      setIsFirebaseConnected(connected);
      if (connected) {
        const pending = await getPendingSyncOperations();
        if (pending.length > 0) {
          setSyncStatus('saving_firebase');
          const res = await flushOfflineSyncQueue();
          const left = await refreshLocalStores();
          setSyncStatus(left > 0 ? 'pending_sync' : 'online_synced');
          if (res.succeeded > 0) {
            // Perbarui activeResult jika baru saja tersinkronisasi
            setActiveResult((prev) => {
              if (!prev) return prev;
              const updatedLocal = findResultBySessionId(prev.sessionId);
              return updatedLocal || prev;
            });
          }
        } else {
          setSyncStatus('online_synced');
        }
      } else {
        const pending = await getPendingSyncOperations();
        setSyncStatus(pending.length > 0 ? 'pending_sync' : 'offline_local');
      }
    });

    const unsubStudents = fbSubscribeStudents((fbList) => {
      if (fbList.length > 0) {
        setStudents(fbList);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(fbList));
      }
    });

    const unsubSettings = fbSubscribeExamSettings(settings.examId, (partial) => {
      if (partial) {
        setSettings((prev) => {
          const merged = { ...prev, ...partial };
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
          return merged;
        });
      }
    });

    const unsubSessions = fbSubscribeAllSessions(settings.examId, (list) => {
      setRemoteSessions(list);
    });

    const unsubResults = fbSubscribeAllResults(settings.examId, (list) => {
      setRemoteResults(list);
    });

    return () => {
      unsubConn();
      unsubStudents();
      unsubSettings();
      unsubSessions();
      unsubResults();
    };
  }, [firebaseVersion, settings.examId, refreshLocalStores]);

  // Save handlers for teacher
  const handleSaveSettings = async (next: ExamSettings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
    if (isFirebaseConfigured() && isOnline) {
      try {
        await fbSaveExamSettings(next);
      } catch {
        // saved locally
      }
    }
  };

  const handleSaveStudents = async (next: StudentRecord[]) => {
    setStudents(next);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(next));
    if (isFirebaseConfigured() && isOnline) {
      try {
        await fbSaveStudents(next);
      } catch {
        // saved locally
      }
    }
  };

  const handleSaveAnswerKeys = async (next: AnswerKeyEntry[]) => {
    setAnswerKeys(next);
    localStorage.setItem(STORAGE_KEYS.ANSWER_KEYS, JSON.stringify(next));
    if (isFirebaseConfigured() && isOnline) {
      try {
        await fbSaveAnswerKeys(settings.examId, next);
      } catch {
        // saved locally
      }
    }
  };

  // Cari sesi yang ada (lokal + Firebase)
  const findExistingSession = async (
    nis: string
  ): Promise<{ session: ExamSession | null; result: ExamResult | null }> => {
    const localSess = findLatestSessionForStudent(nis, settings.examId);
    let remoteSess: ExamSession | null = null;
    if (firebaseConfigured && isOnline) {
      remoteSess = await fbFindLatestSessionForStudent(nis, settings.examId);
    }

    let chosen: ExamSession | null = localSess;
    if (remoteSess && (!localSess || (remoteSess.lastUpdatedAt || 0) >= localSess.lastUpdatedAt)) {
      chosen = remoteSess;
    }

    if (!chosen) return { session: null, result: null };
    const localRes = findResultBySessionId(chosen.sessionId);
    const remoteRes = remoteResults.find((r) => r.sessionId === chosen!.sessionId) || null;
    return { session: chosen, result: remoteRes || localRes };
  };

  // Mulai sesi baru dengan Fisher-Yates shuffle
  const handleStartNewSession = async (student: StudentRecord) => {
    const baseIds = QUESTIONS_DATA.slice(0, settings.jumlahSoal).map((q) => q.id);
    const urutanSoal = settings.acakSoal ? fisherYatesShuffle(baseIds) : baseIds;

    let opsiOrder: Record<number, number[]> | undefined;
    if (settings.acakOpsi) {
      opsiOrder = {};
      for (const q of QUESTIONS_DATA) {
        if (q.options && q.type !== 'boolean') {
          opsiOrder[q.id] = fisherYatesShuffle(q.options.map((_, i) => i));
        }
      }
    }

    const now = Date.now();
    const batasWaktu = now + settings.durasiMenit * 60 * 1000;

    const newSession: ExamSession = {
      sessionId: generateUniqueId(`sess_${student.nis}`),
      examId: settings.examId,
      nis: student.nis,
      nama: student.nama,
      kelas: student.kelas,
      status: 'sedang_mengerjakan',
      urutanSoal,
      opsiOrder,
      jawaban: {},
      soalRaguRagu: {},
      nomorAktif: 1,
      waktuMulai: now,
      batasWaktu,
      pelanggaranTab: [],
      pelanggaranFullscreen: 0,
      sanksiTingkatTertinggi: 0,
      fullscreenAktif: false,
      lastUpdatedAt: now,
    };

    setActiveSession(newSession);
    setRoute('exam');

    if (firebaseConfigured && isOnline && isFirebaseConnected) {
      setSyncStatus('saving_firebase');
    }
    const outcome = await persistAndSyncSession(newSession, isOnline, isFirebaseConnected);
    setSyncStatus(outcome.syncStatus);
    await refreshLocalStores();

    // Sinkronkan juga daftar siswa jika belum ada di Firebase
    if (firebaseConfigured && isOnline) {
      fbGetStudents().then((fbList) => {
        if (fbList && fbList.length === 0) {
          fbSaveStudents(students).catch(() => {});
        }
      });
    }
  };

  const handleResumeSession = (session: ExamSession) => {
    if (session.status === 'submitted') {
      const existingRes =
        remoteResults.find((r) => r.sessionId === session.sessionId) ||
        findResultBySessionId(session.sessionId);
      if (existingRes) {
        setActiveResult(existingRes);
        setRoute('result');
        return;
      }
    }
    setActiveSession(session);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, session.sessionId);
    setRoute('exam');
  };

  // Auto-save real-time saat perubahan terjadi di ExamView
  const handleSessionChange = useCallback(
    (updated: ExamSession, immediateSync = false) => {
      setActiveSession(updated);
      // Simpan lokal sinkron instan
      saveLocalSessionRecord(updated);

      if (syncDebounceRef.current) {
        window.clearTimeout(syncDebounceRef.current);
      }

      const runSync = async () => {
        if (firebaseConfigured && isOnline && isFirebaseConnected) {
          setSyncStatus('saving_firebase');
        }
        const outcome = await persistAndSyncSession(updated, isOnline, isFirebaseConnected);
        setSyncStatus(outcome.syncStatus);
        await refreshLocalStores();
      };

      if (immediateSync) {
        runSync();
      } else {
        syncDebounceRef.current = window.setTimeout(runSync, 750);
      }
    },
    [firebaseConfigured, isOnline, isFirebaseConnected, refreshLocalStores]
  );

  // Pengumpulan ujian (Online / Offline Idempoten)
  const handleSubmitExam = useCallback(
    async (finalSession: ExamSession, autoExpired = false) => {
      if (syncDebounceRef.current) {
        window.clearTimeout(syncDebounceRef.current);
      }

      const submittedAt = Date.now();
      const resultId = finalSession.resultId || `res_${finalSession.sessionId}`;

      const computedResult = calculateExamResult({
        session: finalSession,
        questions: QUESTIONS_DATA.slice(0, settings.jumlahSoal),
        answerKeys,
        settings,
        resultId,
        syncStatus: isOnline && firebaseConfigured && isFirebaseConnected ? 'synced' : 'pending',
        submittedAt,
      });

      if (firebaseConfigured && isOnline && isFirebaseConnected) {
        setSyncStatus('saving_firebase');
      }

      const { finalResult, syncStatus: nextSyncStatus } = await submitAndSyncExamResult(
        computedResult,
        finalSession,
        isOnline,
        isFirebaseConnected
      );

      await saveLocalResultRecord(finalResult);
      setSyncStatus(nextSyncStatus);
      await refreshLocalStores();

      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }

      setActiveSession({ ...finalSession, status: 'submitted', submittedAt, resultId });
      setActiveResult(finalResult);
      setRoute('result');

      if (autoExpired) {
        showToast('info', 'Waktu ujian telah habis. Jawaban Anda dikumpulkan secara otomatis.');
      } else if (finalResult.statusSinkronisasi === 'synced') {
        showToast('success', 'Ujian berhasil dikumpulkan dan tersinkronisasi ke Firebase.');
      } else {
        showToast(
          'warning',
          'Ujian dikumpulkan secara offline. Hasil tersimpan di perangkat dan siap disinkronkan saat online.'
        );
      }
    },
    [
      settings,
      answerKeys,
      isOnline,
      firebaseConfigured,
      isFirebaseConnected,
      refreshLocalStores,
      showToast,
    ]
  );

  const handleRetryResultSync = async () => {
    const res = await flushOfflineSyncQueue();
    await refreshLocalStores();
    if (activeResult) {
      const updated = findResultBySessionId(activeResult.sessionId);
      if (updated) setActiveResult(updated);
    }
    if (res.succeeded > 0) {
      setSyncStatus('online_synced');
      showToast('success', 'Hasil ujian berhasil disinkronkan ke Firebase.');
    } else if (res.lastError) {
      showToast('warning', `Sinkronisasi belum berhasil: ${res.lastError}`);
    } else {
      showToast('warning', 'Pastikan koneksi internet & konfigurasi Firebase sekolah sudah aktif.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 flex flex-col">
      {/* Top Bar (disembunyikan saat berada di halaman ujian fokus karena ExamView memiliki header ujian khusus) */}
      {route !== 'exam' && (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 no-print">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:gap-8">
            {/* Zone 1: Single-line brand */}
            <button
              type="button"
              onClick={() => setRoute('student_login')}
              className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
            >
              <GraduationCap className="h-6 w-6 text-[#2563EB] shrink-0" />
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900">
                Ulangan Harian Kimia
              </span>
            </button>

            {/* Zone 2: Clean text navigation */}
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setRoute('student_login')}
                className={`whitespace-nowrap shrink-0 transition hover:text-slate-900 cursor-pointer ${
                  route === 'student_login' || route === 'result'
                    ? 'text-[#2563EB] font-semibold'
                    : ''
                }`}
              >
                Halaman Siswa
              </button>
              <button
                type="button"
                onClick={() => setRoute('teacher')}
                className={`whitespace-nowrap shrink-0 transition hover:text-slate-900 cursor-pointer ${
                  route === 'teacher' ? 'text-[#2563EB] font-semibold' : ''
                }`}
              >
                Dashboard Guru
              </button>
            </nav>

            {/* Zone 3: Primary utility / PWA Install & Sync Status */}
            <div className="hidden md:flex items-center gap-4 shrink-0">
              <SyncStatusBadge
                status={syncStatus}
                pendingCount={pendingCount}
                firebaseConfigured={firebaseConfigured}
                compact
              />
              <PWAInstallButton />
            </div>
          </div>
        </header>
      )}

      {/* Toast Koneksi / Sinkronisasi */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border bg-white px-4 py-3 shadow-lg no-print">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm">
            {toast.tone === 'warning' ? (
              <WifiOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : toast.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
            )}
            <p className="font-medium text-slate-800">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {route === 'student_login' && (
          <StudentLoginView
            settings={settings}
            students={students}
            isOnline={isOnline}
            isFirebaseConnected={isFirebaseConnected}
            firebaseConfigured={firebaseConfigured}
            onStartNewSession={handleStartNewSession}
            onResumeSession={handleResumeSession}
            onViewSubmittedResult={(res, sess) => {
              setActiveSession(sess);
              setActiveResult(res);
              setRoute('result');
            }}
            findExistingSession={findExistingSession}
          />
        )}

        {route === 'exam' && activeSession && (
          <ExamView
            session={activeSession}
            questions={QUESTIONS_DATA.slice(0, settings.jumlahSoal)}
            settings={settings}
            syncStatus={syncStatus}
            pendingCount={pendingCount}
            firebaseConfigured={firebaseConfigured}
            onSessionChange={handleSessionChange}
            onSubmitExam={handleSubmitExam}
          />
        )}

        {route === 'result' && activeResult && (
          <ResultView
            result={activeResult}
            settings={settings}
            questions={QUESTIONS_DATA.slice(0, settings.jumlahSoal)}
            answerKeys={answerKeys}
            onRetrySync={handleRetryResultSync}
            onReturnHome={() => {
              setActiveResult(null);
              setActiveSession(null);
              setRoute('student_login');
            }}
          />
        )}

        {route === 'teacher' && (
          <TeacherDashboard
            teacherAuth={teacherAuth}
            onTeacherLogin={(auth) => {
              saveTeacherAuth(auth);
              setTeacherAuth(auth);
            }}
            onTeacherLogout={() => {
              saveTeacherAuth(null);
              setTeacherAuth(null);
            }}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            students={students}
            onSaveStudents={handleSaveStudents}
            questions={QUESTIONS_DATA.slice(0, settings.jumlahSoal)}
            answerKeys={answerKeys}
            onSaveAnswerKeys={handleSaveAnswerKeys}
            remoteSessions={remoteSessions}
            remoteResults={remoteResults}
            localSessions={localSessions}
            localResults={localResults}
            firebaseConfigured={firebaseConfigured}
            isFirebaseConnected={isFirebaseConnected}
            onFirebaseConfigUpdated={() => setFirebaseVersion((v) => v + 1)}
          />
        )}
      </main>

      {/* Modal Auto-Detect Resume Sesi Setelah Reload / Chromebook Restart */}
      {reloadResumePrompt && route === 'student_login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">SESI UJIAN DITEMUKAN</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Data jawaban dan waktu pengerjaan sebelumnya berhasil ditemukan.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-[#F3F4F6]/60 p-3.5 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Peserta</span>
                <span className="font-semibold text-slate-900">{reloadResumePrompt.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIS / Kelas</span>
                <span className="font-mono-tabular text-slate-800">
                  {reloadResumePrompt.nis} · {reloadResumePrompt.kelas}
                </span>
              </div>
            </div>

            {reloadResumeShowInfo && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-[#EFF6FF] p-3.5 text-xs text-slate-700 space-y-1">
                <p>
                  <span className="font-semibold">ID Sesi:</span>{' '}
                  <span className="font-mono-tabular">{reloadResumePrompt.sessionId}</span>
                </p>
                <p>
                  <span className="font-semibold">Mulai:</span>{' '}
                  {new Date(reloadResumePrompt.waktuMulai).toLocaleString('id-ID')}
                </p>
                <p>
                  <span className="font-semibold">Batas Waktu:</span>{' '}
                  {new Date(reloadResumePrompt.batasWaktu).toLocaleString('id-ID')}
                </p>
                <p>
                  <span className="font-semibold">Soal Terakhir:</span> No.{' '}
                  {reloadResumePrompt.nomorAktif}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const s = reloadResumePrompt;
                  setReloadResumePrompt(null);
                  handleResumeSession(s);
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                LANJUTKAN PENGERJAAN
              </button>
              <button
                type="button"
                onClick={() => setReloadResumeShowInfo((v) => !v)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {reloadResumeShowInfo ? 'SEMBUNYIKAN INFORMASI SESI' : 'LIHAT INFORMASI SESI'}
              </button>
              <button
                type="button"
                onClick={() => setReloadResumePrompt(null)}
                className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
