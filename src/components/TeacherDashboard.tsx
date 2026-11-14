import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  isPlaceholderConfig,
  resetFirebaseClientInstance,
  saveRuntimeFirebaseConfig,
} from '../config/firebaseConfig';
import { verifyDemoTeacherPin, TeacherSessionAuth } from '../services/authService';
import {
  downloadAllStudentsZipPDF,
  downloadRecapExcel,
  downloadRecapPDF,
  downloadStudentImportTemplate,
  downloadStudentPDF,
  importStudentsFromSpreadsheet,
} from '../services/exportService';
import {
  fbSaveAnswerKeys,
  fbSaveExamSettings,
  fbSaveStudents,
  signInTeacherWithFirebaseEmail,
  signOutFirebaseUser,
  testFirebaseConnection,
} from '../services/firebaseDb';
import { calculateExamResult, isStudentAnswerEmpty } from '../services/scoring';
import {
  AnswerKeyEntry,
  ExamResult,
  ExamSession,
  ExamSettings,
  FirebaseSchoolConfig,
  Question,
  StudentRecord,
} from '../types/exam';

interface TeacherDashboardProps {
  teacherAuth: TeacherSessionAuth | null;
  onTeacherLogin: (auth: TeacherSessionAuth) => void;
  onTeacherLogout: () => void;
  settings: ExamSettings;
  onSaveSettings: (next: ExamSettings) => Promise<void>;
  students: StudentRecord[];
  onSaveStudents: (next: StudentRecord[]) => Promise<void>;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
  onSaveAnswerKeys: (next: AnswerKeyEntry[]) => Promise<void>;
  remoteSessions: ExamSession[];
  remoteResults: ExamResult[];
  localSessions: ExamSession[];
  localResults: ExamResult[];
  firebaseConfigured: boolean;
  isFirebaseConnected: boolean;
  onFirebaseConfigUpdated: () => void;
}

type TeacherTab = 'monitoring' | 'recap' | 'students' | 'keys' | 'settings';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacherAuth,
  onTeacherLogin,
  onTeacherLogout,
  settings,
  onSaveSettings,
  students,
  onSaveStudents,
  questions,
  answerKeys,
  onSaveAnswerKeys,
  remoteSessions,
  remoteResults,
  localSessions,
  localResults,
  firebaseConfigured,
  isFirebaseConnected,
  onFirebaseConfigUpdated,
}) => {
  // Auth gate states
  const [authMode, setAuthMode] = useState<'pin' | 'firebase'>('pin');
  const [pinInput, setPinInput] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbPass, setFbPass] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<TeacherTab>('monitoring');

  // Monitoring & Recap filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStudentResultId, setSelectedStudentResultId] = useState<string>('');
  const [inspectViolationsFor, setInspectViolationsFor] = useState<{
    nama: string;
    nis: string;
    violations: ExamSession['pelanggaranTab'];
  } | null>(null);

  // Student management state
  const [studentForm, setStudentForm] = useState<StudentRecord>({
    nis: '',
    nama: '',
    kelas: 'XI IPA 1',
    status: 'aktif',
  });
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [studentMsg, setStudentMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<ExamSettings>(settings);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // Answer keys draft
  const [keysDraft, setKeysDraft] = useState<AnswerKeyEntry[]>(answerKeys);
  const [keysMsg, setKeysMsg] = useState<string | null>(null);

  // Firebase config form
  const [fbConfigDraft, setFbConfigDraft] = useState<FirebaseSchoolConfig>(() =>
    getActiveFirebaseConfig()
  );
  const [fbTestStatus, setFbTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [fbSaving, setFbSaving] = useState(false);

  // Gabungkan data real-time Firebase (utama saat online) + lokal (cadangan/mode lokal)
  const mergedSessionsMap = useMemo(() => {
    const map = new Map<string, { session: ExamSession; source: 'firebase' | 'local' }>();
    for (const s of localSessions) {
      map.set(s.sessionId, { session: s, source: 'local' });
    }
    for (const s of remoteSessions) {
      const existing = map.get(s.sessionId);
      if (!existing || (s.lastUpdatedAt || 0) >= (existing.session.lastUpdatedAt || 0)) {
        map.set(s.sessionId, { session: s, source: 'firebase' });
      }
    }
    return map;
  }, [localSessions, remoteSessions]);

  // Hasil yang sudah tersinkronisasi (dari Firebase, atau lokal jika mode demo lokal tanpa Firebase)
  const syncedResults = useMemo(() => {
    if (firebaseConfigured) {
      return remoteResults.slice().sort((a, b) => b.waktuPengumpulan - a.waktuPengumpulan);
    }
    // Jika Firebase belum dikonfigurasi, gunakan hasil lokal dengan catatan jujur
    return localResults.slice().sort((a, b) => b.waktuPengumpulan - a.waktuPengumpulan);
  }, [firebaseConfigured, remoteResults, localResults]);

  const pendingSyncResults = useMemo(() => {
    const remoteIds = new Set(remoteResults.map((r) => r.resultId));
    return localResults.filter(
      (r) =>
        (r.statusSinkronisasi !== 'synced' || (firebaseConfigured && !remoteIds.has(r.resultId)))
    );
  }, [localResults, remoteResults, firebaseConfigured]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) set.add(s.kelas);
    return ['ALL', ...Array.from(set).sort()];
  }, [students]);

  // Baris monitoring per siswa terdaftar
  const monitoringRows = useMemo(() => {
    const latestSessionByNis = new Map<string, { session: ExamSession; source: 'firebase' | 'local' }>();
    for (const entry of mergedSessionsMap.values()) {
      const prev = latestSessionByNis.get(entry.session.nis);
      if (!prev || entry.session.lastUpdatedAt > prev.session.lastUpdatedAt) {
        latestSessionByNis.set(entry.session.nis, entry);
      }
    }

    const resultByNis = new Map<string, ExamResult>();
    for (const r of [...pendingSyncResults, ...syncedResults]) {
      const prev = resultByNis.get(r.nis);
      if (!prev || r.waktuPengumpulan > prev.waktuPengumpulan) {
        resultByNis.set(r.nis, r);
      }
    }

    return students.map((st, index) => {
      const sessEntry = latestSessionByNis.get(st.nis);
      const sess = sessEntry?.session;
      const res = resultByNis.get(st.nis);

      let statusPengerjaan: 'Belum mulai' | 'Sedang mengerjakan' | 'Sudah mengumpulkan' = 'Belum mulai';
      if (res || sess?.status === 'submitted') {
        statusPengerjaan = 'Sudah mengumpulkan';
      } else if (sess) {
        statusPengerjaan = 'Sedang mengerjakan';
      }

      const totalQ = sess?.urutanSoal?.length || questions.length;
      let answeredCount = 0;
      if (sess) {
        for (const qId of sess.urutanSoal) {
          if (!isStudentAnswerEmpty(sess.jawaban?.[qId] ?? null)) answeredCount += 1;
        }
      } else if (res) {
        answeredCount = res.benar + res.salah;
      }
      const emptyCount = sess || res ? Math.max(0, totalQ - answeredCount) : totalQ;

      let nilaiSementara: number | null = null;
      if (res) {
        nilaiSementara = res.nilai;
      } else if (sess && settings.tampilkanNilaiSementara) {
        const tempEval = calculateExamResult({
          session: sess,
          questions,
          answerKeys,
          settings,
          resultId: 'preview',
          syncStatus: 'pending',
        });
        nilaiSementara = tempEval.nilai;
      }

      let syncLabel = '-';
      if (res) {
        syncLabel =
          res.statusSinkronisasi === 'synced'
            ? 'Tersinkronisasi'
            : firebaseConfigured
              ? 'Menunggu sinkronisasi'
              : 'Tersimpan lokal';
      } else if (sess) {
        syncLabel =
          sessEntry?.source === 'firebase'
            ? 'Tersinkronisasi'
            : firebaseConfigured
              ? 'Menunggu sinkronisasi'
              : 'Tersimpan lokal';
      }

      return {
        no: index + 1,
        student: st,
        session: sess,
        result: res,
        statusPengerjaan,
        answeredCount,
        emptyCount,
        violationsCount: res?.jumlahPelanggaran ?? sess?.pelanggaranTab?.length ?? 0,
        violationsDetail: res?.pelanggaranDetail ?? sess?.pelanggaranTab ?? [],
        nilai: nilaiSementara,
        waktuPengumpulan: res?.waktuPengumpulan ?? sess?.submittedAt ?? null,
        statusKelulusan: res?.statusKelulusan ?? null,
        syncLabel,
      };
    });
  }, [
    students,
    mergedSessionsMap,
    syncedResults,
    pendingSyncResults,
    questions,
    answerKeys,
    settings,
    firebaseConfigured,
  ]);

  // Statistik Ringkasan Dashboard
  const dashboardStats = useMemo(() => {
    const totalSiswa = students.length;
    const belumMulai = monitoringRows.filter((r) => r.statusPengerjaan === 'Belum mulai').length;
    const sedangMengerjakan = monitoringRows.filter(
      (r) => r.statusPengerjaan === 'Sedang mengerjakan'
    ).length;
    const sudahMengumpulkan = monitoringRows.filter(
      (r) => r.statusPengerjaan === 'Sudah mengumpulkan'
    ).length;
    const menungguSinkron = pendingSyncResults.length;
    const lulusKkm = syncedResults.filter((r) => r.statusKelulusan === 'LULUS').length;
    const remedial = syncedResults.filter((r) => r.statusKelulusan === 'REMIDIAL').length;
    const avgNilai =
      syncedResults.length > 0
        ? (syncedResults.reduce((acc, r) => acc + r.nilai, 0) / syncedResults.length).toFixed(1)
        : '0.0';

    return {
      totalSiswa,
      belumMulai,
      sedangMengerjakan,
      sudahMengumpulkan,
      menungguSinkron,
      lulusKkm,
      remedial,
      avgNilai,
    };
  }, [students.length, monitoringRows, pendingSyncResults.length, syncedResults]);

  const filteredMonitoring = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monitoringRows.filter((row) => {
      if (classFilter !== 'ALL' && row.student.kelas !== classFilter) return false;
      if (q && !row.student.nama.toLowerCase().includes(q) && !row.student.nis.includes(q)) {
        return false;
      }
      return true;
    });
  }, [monitoringRows, classFilter, searchQuery]);

  const filteredRecapResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return syncedResults.filter((r) => {
      if (classFilter !== 'ALL' && r.kelas !== classFilter) return false;
      if (statusFilter !== 'ALL' && r.statusKelulusan !== statusFilter) return false;
      if (q && !r.nama.toLowerCase().includes(q) && !r.nis.includes(q)) return false;
      return true;
    });
  }, [syncedResults, classFilter, statusFilter, searchQuery]);

  // Handler Login Guru
  const handleTeacherAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'pin') {
        const ok = await verifyDemoTeacherPin(pinInput);
        if (!ok) {
          setAuthError('PIN guru tidak valid. Periksa kembali kredensial Anda.');
          return;
        }
        onTeacherLogin({
          authenticated: true,
          method: 'demo_pin',
          loginAt: Date.now(),
        });
      } else {
        const res = await signInTeacherWithFirebaseEmail(fbEmail.trim(), fbPass);
        if (!res.ok) {
          setAuthError(res.error || 'Gagal login menggunakan Firebase Authentication.');
          return;
        }
        onTeacherLogin({
          authenticated: true,
          method: 'firebase_auth',
          email: res.email,
          loginAt: Date.now(),
        });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (!teacherAuth?.authenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Masuk Dashboard Guru</h1>
              <p className="text-xs text-slate-500">
                Pengawasan Ujian, Rekapitulasi & Manajemen Soal
              </p>
            </div>
          </div>

          <div className="mt-5 flex rounded-xl bg-[#F3F4F6] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin');
                setAuthError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                authMode === 'pin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              PIN Guru (Demo)
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('firebase');
                setAuthError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                authMode === 'firebase' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Firebase Auth (Produksi)
            </button>
          </div>

          <form onSubmit={handleTeacherAuthSubmit} className="mt-5 space-y-4">
            {authMode === 'pin' ? (
              <div>
                <label htmlFor="teacher-pin" className="block text-sm font-medium text-slate-800">
                  PIN Akses Guru
                </label>
                <input
                  id="teacher-pin"
                  type="password"
                  autoComplete="off"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setAuthError(null);
                  }}
                  placeholder="Masukkan PIN guru"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="fb-email" className="block text-sm font-medium text-slate-800">
                    Email Guru Sekolah
                  </label>
                  <input
                    id="fb-email"
                    type="email"
                    value={fbEmail}
                    onChange={(e) => setFbEmail(e.target.value)}
                    placeholder="guru@sekolah.sch.id"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="fb-pass" className="block text-sm font-medium text-slate-800">
                    Kata Sandi
                  </label>
                  <input
                    id="fb-pass"
                    type="password"
                    value={fbPass}
                    onChange={(e) => setFbPass(e.target.value)}
                    placeholder="Masukkan kata sandi akun Firebase"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </>
            )}

            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-[#DC2626]">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full min-h-[44px] rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {authLoading ? 'Memverifikasi...' : 'Buka Dashboard Guru'}
            </button>
          </form>

          <p className="mt-5 rounded-xl border border-slate-200 bg-[#F3F4F6]/60 p-3 text-xs leading-relaxed text-slate-600">
            <strong>Catatan Keamanan Produksi:</strong> Autentikasi PIN demo di browser hanya untuk pengujian antarmuka. Untuk pelaksanaan ujian resmi sekolah, wajib gunakan Firebase Authentication dengan role/custom claim guru yang diverifikasi melalui Firebase Security Rules & Cloud Functions.
          </p>
        </div>
      </div>
    );
  }

  // Student CRUD Handlers
  const handleAddOrEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentMsg(null);
    const nis = studentForm.nis.trim();
    const nama = studentForm.nama.trim();
    const kelas = studentForm.kelas.trim() || 'XI IPA 1';
    if (!nis || !nama) {
      setStudentMsg('NIS dan Nama siswa wajib diisi.');
      return;
    }

    let nextList: StudentRecord[];
    if (editingNis) {
      nextList = students.map((s) =>
        s.nis === editingNis ? { nis, nama, kelas, status: studentForm.status } : s
      );
      setEditingNis(null);
      setStudentMsg(`Data siswa ${nama} (${nis}) berhasil diperbarui.`);
    } else {
      if (students.some((s) => s.nis === nis)) {
        setStudentMsg(`NIS ${nis} sudah terdaftar.`);
        return;
      }
      nextList = [...students, { nis, nama, kelas, status: studentForm.status }];
      setStudentMsg(`Siswa ${nama} (${nis}) berhasil ditambahkan.`);
    }

    setStudentForm({ nis: '', nama: '', kelas: 'XI IPA 1', status: 'aktif' });
    await onSaveStudents(nextList);
  };

  const handleBulkPasteImport = async () => {
    setStudentMsg(null);
    const lines = bulkPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const map = new Map<string, StudentRecord>();
    for (const s of students) map.set(s.nis, s);
    let added = 0;

    for (const line of lines) {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const [nis, nama, kelas] = parts;
        map.set(nis, { nis, nama, kelas: kelas || 'XI IPA 1', status: 'aktif' });
        added += 1;
      }
    }

    await onSaveStudents(Array.from(map.values()));
    setBulkPasteText('');
    setStudentMsg(`${added} data siswa berhasil diimpor dari teks.`);
  };

  const handleSpreadsheetImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStudentMsg(null);
    try {
      const imported = await importStudentsFromSpreadsheet(file);
      if (imported.length === 0) {
        setStudentMsg('Tidak ditemukan baris valid (pastikan terdapat kolom NIS dan Nama).');
        return;
      }
      const map = new Map<string, StudentRecord>();
      for (const s of students) map.set(s.nis, s);
      for (const s of imported) map.set(s.nis, s);
      await onSaveStudents(Array.from(map.values()));
      setStudentMsg(`${imported.length} siswa berhasil diimpor dari ${file.name}.`);
    } catch {
      setStudentMsg('Gagal membaca file Excel/CSV.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const unverifiedKeysCount = keysDraft.filter((k) => !k.verifiedByTeacher).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header Dashboard Guru */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#2563EB]">
            Dashboard Guru · {settings.mataPelajaran} ({settings.materi})
          </p>
          <h1 className="mt-0.5 text-xl sm:text-2xl font-bold text-slate-900">
            {settings.judul}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span>
              Autentikasi:{' '}
              {teacherAuth.method === 'firebase_auth'
                ? `Firebase Auth (${teacherAuth.email})`
                : 'Mode Demo PIN Internal'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Database:{' '}
              {firebaseConfigured
                ? isFirebaseConnected
                  ? 'Firebase Realtime Database Aktif'
                  : 'Firebase Terkonfigurasi (Menghubungkan...)'
                : 'Penyimpanan Lokal (Firebase belum dikonfigurasi)'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOutFirebaseUser();
            onTeacherLogout();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Keluar Dashboard Guru
        </button>
      </div>

      {/* Ringkasan Statistik (8 Kartu) */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Terdaftar</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 font-mono-tabular">
            {dashboardStats.totalSiswa}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Belum Mulai</p>
          <p className="mt-1 text-2xl font-bold text-slate-600 font-mono-tabular">
            {dashboardStats.belumMulai}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Mengerjakan</p>
          <p className="mt-1 text-2xl font-bold text-[#2563EB] font-mono-tabular">
            {dashboardStats.sedangMengerjakan}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Mengumpulkan</p>
          <p className="mt-1 text-2xl font-bold text-[#16A34A] font-mono-tabular">
            {dashboardStats.sudahMengumpulkan}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Menunggu Sinkron</p>
          <p className="mt-1 text-2xl font-bold text-orange-600 font-mono-tabular">
            {dashboardStats.menungguSinkron}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Lulus KKM (≥{settings.kkm})</p>
          <p className="mt-1 text-2xl font-bold text-[#16A34A] font-mono-tabular">
            {dashboardStats.lulusKkm}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-xs text-slate-500">Remedial (&lt;{settings.kkm})</p>
          <p className="mt-1 text-2xl font-bold text-[#DC2626] font-mono-tabular">
            {dashboardStats.remedial}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[#EFF6FF] p-3.5">
          <p className="text-xs text-[#2563EB] font-medium">Rata-rata Kelas</p>
          <p className="mt-1 text-2xl font-bold text-[#2563EB] font-mono-tabular">
            {dashboardStats.avgNilai}
          </p>
        </div>
      </div>

      {/* Tab Navigasi Dashboard */}
      <div className="mt-6 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        {[
          { id: 'monitoring', label: 'Monitoring Ujian', icon: ShieldCheck },
          { id: 'recap', label: 'Rekapitulasi & Ekspor', icon: FileSpreadsheet },
          { id: 'students', label: 'Manajemen Siswa', icon: Users },
          {
            id: 'keys',
            label: `Kunci Jawaban (${unverifiedKeysCount > 0 ? `${unverifiedKeysCount} perlu cek` : 'Terverifikasi'})`,
            icon: KeyRound,
          },
          { id: 'settings', label: 'Pengaturan & Firebase', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TeacherTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MONITORING REAL-TIME */}
      {activeTab === 'monitoring' && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Monitoring Pengerjaan Real-Time</h2>
              <p className="text-xs text-slate-500">
                Memantau status pengerjaan, soal terjawab, pelanggaran tab, dan status sinkronisasi peserta.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama / NIS..."
                  className="rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs sm:text-sm focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[#2563EB] focus:outline-none"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'Semua Kelas' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F3F4F6]/70 text-slate-700">
                  <th className="px-3 py-2.5 font-semibold">No</th>
                  <th className="px-3 py-2.5 font-semibold">Nama Siswa</th>
                  <th className="px-3 py-2.5 font-semibold">NIS</th>
                  <th className="px-3 py-2.5 font-semibold">Kelas</th>
                  <th className="px-3 py-2.5 font-semibold">Status Pengerjaan</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Dijawab</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Kosong</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Pelanggaran Tab</th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    {settings.tampilkanNilaiSementara ? 'Nilai Sementara/Akhir' : 'Nilai Akhir'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Sinkronisasi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonitoring.map((row) => (
                  <tr
                    key={row.student.nis}
                    className="border-b border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-2.5 font-mono-tabular text-slate-500">{row.no}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{row.student.nama}</td>
                    <td className="px-3 py-2.5 font-mono-tabular text-slate-700">
                      {row.student.nis}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.student.kelas}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`font-semibold ${
                          row.statusPengerjaan === 'Sudah mengumpulkan'
                            ? 'text-[#16A34A]'
                            : row.statusPengerjaan === 'Sedang mengerjakan'
                              ? 'text-[#2563EB]'
                              : 'text-slate-500'
                        }`}
                      >
                        {row.statusPengerjaan}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-800">
                      {row.answeredCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-500">
                      {row.emptyCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular">
                      {row.violationsCount > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setInspectViolationsFor({
                              nama: row.student.nama,
                              nis: row.student.nis,
                              violations: row.violationsDetail,
                            })
                          }
                          className="font-bold text-[#DC2626] underline cursor-pointer"
                        >
                          {row.violationsCount} kali
                        </button>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                      {row.nilai !== null ? row.nilai : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span
                        className={`font-semibold ${
                          row.syncLabel === 'Tersinkronisasi'
                            ? 'text-[#16A34A]'
                            : row.syncLabel === 'Menunggu sinkronisasi'
                              ? 'text-orange-600'
                              : row.syncLabel === 'Tersimpan lokal'
                                ? 'text-amber-700'
                                : 'text-slate-400'
                        }`}
                      >
                        {row.syncLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: REKAPITULASI & EKSPOR */}
      {activeTab === 'recap' && (
        <section className="mt-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Rekapitulasi Nilai & Ekspor Dokumen</h2>
                <p className="text-xs text-slate-500">
                  {firebaseConfigured
                    ? 'Data rekapitulasi diambil dari hasil yang telah tersinkronisasi di Firebase Realtime Database.'
                    : 'Menampilkan hasil lokal perangkat (hubungkan Firebase sekolah untuk rekapitulasi lintas Chromebook).'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={filteredRecapResults.length === 0}
                  onClick={() => downloadRecapPDF({ results: filteredRecapResults, settings })}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  Download Rekapitulasi PDF
                </button>

                <button
                  type="button"
                  disabled={filteredRecapResults.length === 0}
                  onClick={() => downloadRecapExcel({ results: filteredRecapResults, settings })}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Rekapitulasi Excel
                </button>

                <button
                  type="button"
                  disabled={filteredRecapResults.length === 0}
                  onClick={() =>
                    downloadAllStudentsZipPDF({
                      results: filteredRecapResults,
                      settings,
                      questions,
                      answerKeys,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <Archive className="h-4 w-4" />
                  Download Semua Hasil Siswa
                </button>
              </div>
            </div>

            {/* Filter Bar + Unduh Hasil 1 Siswa */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIS..."
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-[#2563EB] focus:outline-none"
                />
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm"
                >
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'Semua Kelas' : c}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="LULUS">LULUS</option>
                  <option value="REMIDIAL">REMIDIAL</option>
                  <option value="DISKUALIFIKASI">DISKUALIFIKASI</option>
                </select>
              </div>

              {filteredRecapResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStudentResultId || filteredRecapResults[0].resultId}
                    onChange={(e) => setSelectedStudentResultId(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm max-w-[220px]"
                  >
                    {filteredRecapResults.map((r) => (
                      <option key={r.resultId} value={r.resultId}>
                        {r.nama} ({r.nis})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        filteredRecapResults.find(
                          (r) => r.resultId === (selectedStudentResultId || filteredRecapResults[0].resultId)
                        ) || filteredRecapResults[0];
                      downloadStudentPDF({
                        result: target,
                        settings,
                        questions,
                        answerKeys,
                        includeExplanations: settings.tampilkanPembahasan,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Hasil Siswa PDF
                  </button>
                </div>
              )}
            </div>

            {filteredRecapResults.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Belum ada hasil ujian yang tersinkronisasi untuk filter yang dipilih.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F3F4F6]/70 text-slate-700">
                      <th className="px-3 py-2.5 font-semibold">No</th>
                      <th className="px-3 py-2.5 font-semibold">Nama Siswa</th>
                      <th className="px-3 py-2.5 font-semibold">NIS</th>
                      <th className="px-3 py-2.5 font-semibold">Kelas</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Nilai Akhir</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Benar</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Salah</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Kosong</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Pelanggaran</th>
                      <th className="px-3 py-2.5 font-semibold">Status Kelulusan</th>
                      <th className="px-3 py-2.5 font-semibold">Status Pengumpulan</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Dokumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecapResults.map((r, idx) => (
                      <tr key={r.resultId} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-mono-tabular text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{r.nama}</td>
                        <td className="px-3 py-2.5 font-mono-tabular text-slate-700">{r.nis}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.kelas}</td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular font-bold text-slate-900">
                          {r.nilai}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular text-[#16A34A]">
                          {r.benar}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular text-[#DC2626]">
                          {r.salah}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-500">
                          {r.kosong}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-tabular text-slate-700">
                          {r.jumlahPelanggaran}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-bold ${
                              r.statusKelulusan === 'LULUS' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}
                          >
                            {r.statusKelulusan}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          Sudah Mengumpulkan
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              downloadStudentPDF({
                                result: r,
                                settings,
                                questions,
                                answerKeys,
                                includeExplanations: settings.tampilkanPembahasan,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daftar Terpisah untuk Hasil yang Belum Tersinkronisasi */}
          {pendingSyncResults.length > 0 && firebaseConfigured && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Pengumpulan Lokal Menunggu Sinkronisasi ({pendingSyncResults.length})
              </h3>
              <p className="mt-1 text-xs text-amber-800">
                Data di bawah ini baru tersimpan di perangkat lokal dan belum terkonfirmasi masuk ke Firebase Realtime Database sehingga belum dimasukkan ke rekapitulasi resmi.
              </p>
              <div className="mt-3 space-y-2 text-xs">
                {pendingSyncResults.map((pr) => (
                  <div
                    key={pr.resultId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3.5 py-2.5"
                  >
                    <span className="font-semibold text-slate-900">
                      {pr.nama} ({pr.nis}) · Nilai lokal: {pr.nilai}
                    </span>
                    <span className="font-semibold text-orange-600">
                      BELUM TERSINKRONISASI
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: MANAJEMEN SISWA */}
      {activeTab === 'students' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleAddOrEditStudent}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-slate-900">
                {editingNis ? `Edit Data Siswa (${editingNis})` : 'Tambah Siswa Baru'}
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700">NIS</label>
                <input
                  type="text"
                  value={studentForm.nis}
                  disabled={Boolean(editingNis)}
                  onChange={(e) => setStudentForm((p) => ({ ...p, nis: e.target.value }))}
                  placeholder="Contoh: 2026009"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  value={studentForm.nama}
                  onChange={(e) => setStudentForm((p) => ({ ...p, nama: e.target.value }))}
                  placeholder="Nama lengkap siswa"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Kelas</label>
                  <input
                    type="text"
                    value={studentForm.kelas}
                    onChange={(e) => setStudentForm((p) => ({ ...p, kelas: e.target.value }))}
                    placeholder="XI IPA 1"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={studentForm.status}
                    onChange={(e) =>
                      setStudentForm((p) => ({
                        ...p,
                        status: e.target.value as StudentRecord['status'],
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  {editingNis ? 'Simpan Perubahan' : 'Tambah Siswa'}
                </button>
                {editingNis && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNis(null);
                      setStudentForm({ nis: '', nama: '', kelas: 'XI IPA 1', status: 'aktif' });
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            {/* Impor Data Siswa */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Impor Data Siswa</h2>
                <button
                  type="button"
                  onClick={downloadStudentImportTemplate}
                  className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Unduh Template Excel
                </button>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleSpreadsheetImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[#F3F4F6]/60 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  Pilih File Excel (.xlsx) atau CSV
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Atau Tempel Daftar Siswa (Format: NIS, Nama, Kelas)
                </label>
                <textarea
                  rows={4}
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder={'2026010, Budi Santoso, XI IPA 1\n2026011, Dewi Kartika, XI IPA 2'}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs font-mono-tabular"
                />
                <button
                  type="button"
                  onClick={handleBulkPasteImport}
                  className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Impor dari Teks
                </button>
              </div>

              {studentMsg && (
                <p className="rounded-xl border border-blue-200 bg-[#EFF6FF] p-3 text-xs font-medium text-slate-800">
                  {studentMsg}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">
                Daftar Siswa Terdaftar ({students.length})
              </h2>
              {firebaseConfigured && (
                <button
                  type="button"
                  onClick={async () => {
                    await fbSaveStudents(students);
                    setStudentMsg('Seluruh daftar siswa disinkronkan ke Firebase.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#2563EB] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sinkronkan ke Firebase
                </button>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F3F4F6]/70 text-slate-700">
                    <th className="px-3 py-2.5 font-semibold">NIS</th>
                    <th className="px-3 py-2.5 font-semibold">Nama Siswa</th>
                    <th className="px-3 py-2.5 font-semibold">Kelas</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.nis} className="border-b border-slate-100">
                      <td className="px-3 py-2.5 font-mono-tabular text-slate-700">{s.nis}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{s.nama}</td>
                      <td className="px-3 py-2.5 text-slate-600">{s.kelas}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs font-semibold ${
                            s.status === 'aktif' ? 'text-[#16A34A]' : 'text-slate-400'
                          }`}
                        >
                          {s.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNis(s.nis);
                            setStudentForm(s);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const next = students.filter((item) => item.nis !== s.nis);
                            await onSaveStudents(next);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: KUNCI JAWABAN & PEMBAHASAN */}
      {activeTab === 'keys' && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Konfigurasi Kunci Jawaban, Bobot Poin & Pembahasan
              </h2>
              <p className="text-xs text-slate-600">
                Periksa dan verifikasi kunci jawaban sebelum ujian diterbitkan. Siswa tidak memiliki akses ke halaman maupun objek kunci jawaban ini.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setKeysDraft((prev) => prev.map((k) => ({ ...k, verifiedByTeacher: true })))
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-[#16A34A] hover:bg-emerald-100 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Tandai Semua Terverifikasi
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveAnswerKeys(keysDraft);
                  if (firebaseConfigured) {
                    try {
                      await fbSaveAnswerKeys(settings.examId, keysDraft);
                    } catch {
                      // local already saved
                    }
                  }
                  setKeysMsg('Konfigurasi kunci jawaban dan pembahasan berhasil disimpan.');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                Simpan Kunci Jawaban
              </button>
            </div>
          </div>

          {keysMsg && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-[#16A34A]">
              {keysMsg}
            </div>
          )}

          <div className="mt-4 space-y-4">
            {questions.map((q) => {
              const keyEntry = keysDraft.find((k) => k.questionId === q.id);
              if (!keyEntry) return null;

              const updateKey = (patch: Partial<AnswerKeyEntry>) => {
                setKeysDraft((prev) =>
                  prev.map((k) => (k.questionId === q.id ? { ...k, ...patch } : k))
                );
              };

              return (
                <div key={q.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">
                      Soal No. {q.id}{' '}
                      <span className="font-normal text-xs text-slate-500">
                        ({q.type.toUpperCase()})
                      </span>
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        Bobot Poin:
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={keyEntry.points}
                          onChange={(e) => updateKey({ points: Number(e.target.value) || 1 })}
                          className="w-16 rounded-lg border border-slate-300 px-2 py-1 font-mono-tabular text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateKey({ verifiedByTeacher: !keyEntry.verifiedByTeacher })
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                          keyEntry.verifiedByTeacher
                            ? 'bg-emerald-50 text-[#16A34A] border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {keyEntry.verifiedByTeacher ? 'Terverifikasi Guru' : 'Belum Diverifikasi'}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-700 whitespace-pre-line">{q.prompt}</p>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Kunci Jawaban:</p>
                      {q.type === 'single' && q.options && (
                        <select
                          value={keyEntry.correctIndex ?? 0}
                          onChange={(e) => updateKey({ correctIndex: Number(e.target.value) })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                        >
                          {q.options.map((opt, idx) => (
                            <option key={idx} value={idx}>
                              {String.fromCharCode(65 + idx)}. {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.type === 'multiple' && q.options && (
                        <div className="space-y-1">
                          {q.options.map((opt, idx) => {
                            const checked = (keyEntry.correctIndices || []).includes(idx);
                            return (
                              <label key={idx} className="flex items-start gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const curr = keyEntry.correctIndices || [];
                                    const next = e.target.checked
                                      ? [...curr, idx]
                                      : curr.filter((x) => x !== idx);
                                    updateKey({ correctIndices: next });
                                  }}
                                  className="mt-0.5"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'boolean' && (
                        <div className="flex gap-3">
                          {[true, false].map((val) => (
                            <label key={String(val)} className="inline-flex items-center gap-1.5 text-xs">
                              <input
                                type="radio"
                                name={`key_bool_${q.id}`}
                                checked={keyEntry.correctBoolean === val}
                                onChange={() => updateKey({ correctBoolean: val })}
                              />
                              <span>
                                {val ? q.options?.[0] || 'Benar' : q.options?.[1] || 'Salah'}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === 'short' && (
                        <input
                          type="text"
                          value={(keyEntry.acceptedAnswers || []).join(', ')}
                          onChange={(e) =>
                            updateKey({
                              acceptedAnswers: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Pisahkan variasi jawaban dengan koma"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono-tabular"
                        />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5">Pembahasan:</p>
                      <textarea
                        rows={2}
                        value={keyEntry.explanation}
                        onChange={(e) => updateKey({ explanation: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 5: PENGATURAN UJIAN & KONFIGURASI FIREBASE */}
      {activeTab === 'settings' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Pengaturan Ujian */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Pengaturan Pelaksanaan Ujian</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Ujian</label>
                <input
                  type="text"
                  value={settingsDraft.judul}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, judul: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Guru</label>
                <input
                  type="text"
                  value={settingsDraft.namaGuru}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, namaGuru: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Mata Pelajaran</label>
                <input
                  type="text"
                  value={settingsDraft.mataPelajaran}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, mataPelajaran: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Materi</label>
                <input
                  type="text"
                  value={settingsDraft.materi}
                  onChange={(e) => setSettingsDraft((p) => ({ ...p, materi: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Token Ujian</label>
                <input
                  type="text"
                  value={settingsDraft.token}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, token: e.target.value.toUpperCase() }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular uppercase"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Durasi (mnt)</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={settingsDraft.durasiMenit}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({
                        ...p,
                        durasiMenit: Number(e.target.value) || 60,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">KKM</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft.kkm}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({ ...p, kkm: Number(e.target.value) || 78 }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Soal</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settingsDraft.jumlahSoal}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({
                        ...p,
                        jumlahSoal: Math.min(30, Math.max(1, Number(e.target.value) || 30)),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Waktu Mulai Jadwal (Opsional)
                </label>
                <input
                  type="datetime-local"
                  value={settingsDraft.waktuMulaiJadwal}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, waktuMulaiJadwal: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Waktu Selesai Jadwal (Opsional)
                </label>
                <input
                  type="datetime-local"
                  value={settingsDraft.waktuSelesaiJadwal}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, waktuSelesaiJadwal: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs sm:text-sm">
              {[
                { key: 'acakSoal', label: 'Acak urutan soal (Fisher-Yates)' },
                { key: 'acakOpsi', label: 'Acak urutan pilihan jawaban' },
                { key: 'sanksiTabAktif', label: 'Aktifkan sanksi perpindahan tab' },
                { key: 'wajibFullscreen', label: 'Wajibkan mode fullscreen saat ujian' },
                { key: 'tampilkanNilaiSementara', label: 'Tampilkan nilai sementara di monitoring' },
                { key: 'tampilkanPembahasan', label: 'Tampilkan pembahasan soal ke siswa' },
                { key: 'izinkanSesiBaru', label: 'Izinkan siswa mulai sesi baru saat resume' },
                { key: 'izinkanKembaliBeranda', label: 'Izinkan kembali ke beranda setelah submit' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsDraft[opt.key as keyof ExamSettings])}
                    onChange={(e) =>
                      setSettingsDraft((p) => ({ ...p, [opt.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded text-[#2563EB]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sanksi Tingkat 1 (Poin)
                </label>
                <input
                  type="number"
                  value={settingsDraft.sanksiTingkat1}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, sanksiTingkat1: Number(e.target.value) || 10 }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sanksi Tingkat 2 (Poin)
                </label>
                <input
                  type="number"
                  value={settingsDraft.sanksiTingkat2}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({ ...p, sanksiTingkat2: Number(e.target.value) || 20 }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Batas Diskualifikasi
                </label>
                <input
                  type="number"
                  min={2}
                  value={settingsDraft.batasDiskualifikasi}
                  onChange={(e) =>
                    setSettingsDraft((p) => ({
                      ...p,
                      batasDiskualifikasi: Number(e.target.value) || 3,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-mono-tabular"
                />
              </div>
            </div>

            {settingsMsg && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-[#16A34A]">
                {settingsMsg}
              </p>
            )}

            <button
              type="button"
              onClick={async () => {
                setSettingsMsg(null);
                await onSaveSettings(settingsDraft);
                if (firebaseConfigured) {
                  try {
                    await fbSaveExamSettings(settingsDraft);
                    setSettingsMsg('Pengaturan ujian disimpan dan disinkronkan ke Firebase.');
                    return;
                  } catch {
                    // fallback notice
                  }
                }
                setSettingsMsg('Pengaturan ujian disimpan secara lokal.');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Simpan Pengaturan Ujian
            </button>
          </div>

          {/* Konfigurasi Firebase Sekolah */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-[#2563EB]" />
              <h2 className="text-lg font-bold text-slate-900">
                Konfigurasi Firebase Realtime Database
              </h2>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Isi konfigurasi proyek Firebase milik sekolah (atau melalui variabel lingkungan <code className="font-mono-tabular bg-slate-100 px-1 rounded">VITE_FIREBASE_*</code>) agar seluruh Chromebook siswa terhubung real-time ke dashboard guru.
            </p>

            <div className="space-y-3 text-xs">
              {[
                { field: 'apiKey', label: 'API Key', placeholder: 'AIzaSy...' },
                {
                  field: 'authDomain',
                  label: 'Auth Domain',
                  placeholder: 'sekolah-cbt.firebaseapp.com',
                },
                {
                  field: 'databaseURL',
                  label: 'Database URL (RTDB)',
                  placeholder: 'https://sekolah-cbt-default-rtdb.asia-southeast1.firebasedatabase.app',
                },
                { field: 'projectId', label: 'Project ID', placeholder: 'sekolah-cbt' },
                { field: 'appId', label: 'App ID', placeholder: '1:123456:web:abcdef' },
              ].map((item) => (
                <div key={item.field}>
                  <label className="block font-semibold text-slate-700">{item.label}</label>
                  <input
                    type="text"
                    value={fbConfigDraft[item.field as keyof FirebaseSchoolConfig] || ''}
                    onChange={(e) =>
                      setFbConfigDraft((p) => ({ ...p, [item.field]: e.target.value }))
                    }
                    placeholder={item.placeholder}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
              ))}
            </div>

            {fbTestStatus && (
              <div
                className={`rounded-xl border p-3 text-xs ${
                  fbTestStatus.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-[#DC2626]'
                }`}
              >
                {fbTestStatus.message}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={fbSaving}
                onClick={async () => {
                  setFbSaving(true);
                  setFbTestStatus(null);
                  try {
                    if (isPlaceholderConfig(fbConfigDraft)) {
                      setFbTestStatus({
                        ok: false,
                        message:
                          'Lengkapi API Key, Database URL (https://...), dan Project ID milik sekolah terlebih dahulu.',
                      });
                      return;
                    }
                    saveRuntimeFirebaseConfig(fbConfigDraft);
                    resetFirebaseClientInstance();
                    onFirebaseConfigUpdated();
                    const res = await testFirebaseConnection();
                    setFbTestStatus(res);
                  } finally {
                    setFbSaving(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                {fbSaving ? 'Menguji...' : 'Simpan & Uji Koneksi'}
              </button>

              <button
                type="button"
                onClick={() => {
                  saveRuntimeFirebaseConfig(null);
                  resetFirebaseClientInstance();
                  onFirebaseConfigUpdated();
                  setFbConfigDraft(getActiveFirebaseConfig());
                  setFbTestStatus({
                    ok: true,
                    message: 'Konfigurasi dikembalikan ke variabel lingkungan / placeholder.',
                  });
                }}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F3F4F6]/60 p-3.5 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">Keamanan Rules & Backend:</p>
              <p>
                File <code className="font-mono-tabular">database.rules.json</code> dan{' '}
                <code className="font-mono-tabular">functions/index.ts</code> telah disertakan di repositori proyek untuk membatasi akses tulis/baca siswa, menyembunyikan kunci jawaban pada node <code className="font-mono-tabular">examSecrets</code>, dan memvalidasi pengumpulan secara idempoten.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Modal Riwayat Pelanggaran Siswa */}
      {inspectViolationsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Riwayat Pelanggaran Tab — {inspectViolationsFor.nama}
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular">
                  NIS: {inspectViolationsFor.nis}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectViolationsFor(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto space-y-2.5">
              {inspectViolationsFor.violations.map((v, idx) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-slate-800"
                >
                  <div className="flex justify-between font-semibold text-[#DC2626]">
                    <span>
                      Pelanggaran #{idx + 1} (Tingkat {v.tier})
                    </span>
                    <span className="font-mono-tabular">
                      {new Date(v.timestamp).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-700">{v.description}</p>
                  <p className="mt-0.5 text-slate-500">Saat mengerjakan soal asli no. {v.questionNumber}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setInspectViolationsFor(null)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
