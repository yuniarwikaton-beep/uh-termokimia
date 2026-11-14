import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  MonitorCheck,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { GENERAL_INSTRUCTIONS } from '../data/questions';
import { ExamResult, ExamSession, ExamSettings, StudentRecord } from '../types/exam';

interface StudentLoginViewProps {
  settings: ExamSettings;
  students: StudentRecord[];
  isOnline: boolean;
  isFirebaseConnected: boolean;
  firebaseConfigured: boolean;
  onStartNewSession: (student: StudentRecord) => void;
  onResumeSession: (session: ExamSession) => void;
  onViewSubmittedResult: (result: ExamResult, session: ExamSession) => void;
  findExistingSession: (nis: string) => Promise<{
    session: ExamSession | null;
    result: ExamResult | null;
  }>;
}

export const StudentLoginView: React.FC<StudentLoginViewProps> = ({
  settings,
  students,
  isOnline,
  isFirebaseConnected,
  firebaseConfigured,
  onStartNewSession,
  onResumeSession,
  onViewSubmittedResult,
  findExistingSession,
}) => {
  const [nis, setNis] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Resume session modal state
  const [foundSession, setFoundSession] = useState<ExamSession | null>(null);
  const [foundStudent, setFoundStudent] = useState<StudentRecord | null>(null);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<{
    session: ExamSession;
    result: ExamResult | null;
  } | null>(null);

  const matchedStudent = useMemo(() => {
    const cleanNis = nis.trim();
    if (!cleanNis) return null;
    return students.find((s) => s.nis.trim() === cleanNis) || null;
  }, [nis, students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittedNotice(null);

    const cleanNis = nis.trim();
    const cleanToken = token.trim();

    if (!cleanNis) {
      setError('Masukkan Nomor Induk Siswa (NIS) Anda terlebih dahulu.');
      return;
    }
    if (!cleanToken) {
      setError('Masukkan Token Ujian yang diberikan oleh guru.');
      return;
    }

    const student = students.find((s) => s.nis.trim() === cleanNis);
    if (!student) {
      setError('NIS tidak ditemukan pada daftar peserta terdaftar. Periksa kembali NIS Anda atau hubungi guru.');
      return;
    }
    if (student.status !== 'aktif') {
      setError('Status kepesertaan Anda saat ini nonaktif. Hubungi guru pengawas.');
      return;
    }

    if (cleanToken.toUpperCase() !== settings.token.trim().toUpperCase()) {
      setError('Token Ujian tidak sesuai. Pastikan huruf dan angka token benar.');
      return;
    }

    // Cek jadwal ujian jika diatur guru
    const now = Date.now();
    if (settings.waktuMulaiJadwal) {
      const startMs = new Date(settings.waktuMulaiJadwal).getTime();
      if (!Number.isNaN(startMs) && now < startMs) {
        setError(
          `Ujian belum dibuka. Jadwal mulai: ${new Date(startMs).toLocaleString('id-ID')}.`
        );
        return;
      }
    }
    if (settings.waktuSelesaiJadwal) {
      const endMs = new Date(settings.waktuSelesaiJadwal).getTime();
      if (!Number.isNaN(endMs) && now > endMs) {
        setError(
          `Jadwal ujian telah ditutup pada ${new Date(endMs).toLocaleString('id-ID')}.`
        );
        return;
      }
    }

    setIsChecking(true);
    try {
      const existing = await findExistingSession(student.nis);
      if (existing.session) {
        if (existing.session.status === 'submitted') {
          setSubmittedNotice({ session: existing.session, result: existing.result });
          return;
        }
        // Sesi belum selesai ditemukan -> wajib tampilkan modal pilihan resume
        setFoundStudent(student);
        setFoundSession(existing.session);
        setShowSessionInfo(false);
        return;
      }

      onStartNewSession(student);
    } finally {
      setIsChecking(false);
    }
  };

  const answeredCount = foundSession
    ? Object.values(foundSession.jawaban || {}).filter(
        (v) => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
      ).length
    : 0;

  const remainingMs = foundSession ? Math.max(0, foundSession.batasWaktu - Date.now()) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        {/* Kolom Kiri: Identitas Asesmen & Petunjuk Pelaksanaan */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <div className="flex items-center gap-4">
              {!logoError ? (
                <img
                  src="/assets/aistudio/logo_MAB_bulat_43c8f5a1.png"
                  alt="Logo Ar-Rohmah Bogor"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-16 w-16 rounded-xl border border-slate-200 object-cover shrink-0"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#2563EB] text-white font-bold text-xl shrink-0">
                  K
                </div>
              )}
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
                  Computer Based Test (CBT)
                </p>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
                  {settings.judul}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Materi: {settings.materi}</span>
                  <span aria-hidden="true">·</span>
                  <span>{settings.jumlahSoal} Soal</span>
                  <span aria-hidden="true">·</span>
                  <span>Durasi {settings.durasiMenit} Menit</span>
                </div>
              </div>
            </div>

            <div className="my-6 border-t border-slate-200" />

            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <BookOpen className="h-4 w-4 text-[#2563EB]" />
                {GENERAL_INSTRUCTIONS.title}
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-700 list-disc pl-5">
                {GENERAL_INSTRUCTIONS.paragraphs.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-xl bg-[#EFF6FF] p-4 sm:p-5 border border-blue-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#2563EB]" />
                Ketentuan Pelaksanaan Ujian
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 text-xs sm:text-sm text-slate-700 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <MonitorCheck className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <span>
                    Mode layar penuh (fullscreen) diaktifkan saat ujian dimulai.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <span>
                    Timer tetap berjalan sesuai waktu mulai meski perangkat dimuat ulang.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Perpindahan tab browser dicatat (Tingkat 1: −10, Tingkat 2: −20, Tingkat 3: Diskualifikasi).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <span>
                    Jawaban tersimpan otomatis di perangkat dan tersinkronisasi ke Firebase saat online.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>KKM Penilaian: {settings.kkm} · Nilai Maksimal: 100</span>
            <span>
              Status Layanan:{' '}
              {firebaseConfigured
                ? isOnline && isFirebaseConnected
                  ? 'Terhubung ke Firebase Sekolah'
                  : 'Mode Semi-Online (Lokal Aktif)'
                : 'Mode Lokal Perangkat'}
            </span>
          </div>
        </div>

        {/* Kolom Kanan: Form Masuk Siswa */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col justify-center">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
              Login Murid
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Identitas & Token Ujian
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Masukkan NIS terdaftar dan Token Ujian dari guru pengawas untuk memulai atau melanjutkan sesi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="student-nis" className="block text-sm font-medium text-slate-800">
                Nomor Induk Siswa (NIS)
              </label>
              <input
                id="student-nis"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={nis}
                onChange={(e) => {
                  setNis(e.target.value);
                  setError(null);
                  setSubmittedNotice(null);
                }}
                placeholder="Contoh: 2026001"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 font-mono-tabular"
              />

              {matchedStudent && (
                <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-sm text-emerald-900">
                  <UserCheck className="h-4 w-4 text-[#16A34A] shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{matchedStudent.nama}</p>
                    <p className="text-xs text-emerald-700">
                      Kelas {matchedStudent.kelas} · Terdaftar
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="exam-token" className="block text-sm font-medium text-slate-800">
                Token Ujian
              </label>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="exam-token"
                  type={showToken ? 'text' : 'password'}
                  autoComplete="off"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setError(null);
                  }}
                  placeholder="Masukkan token dari guru"
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-3 text-base uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 font-mono-tabular"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showToken ? 'Sembunyikan token' : 'Tampilkan token'}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-[#DC2626]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {submittedNotice && (
              <div className="rounded-xl border border-blue-200 bg-[#EFF6FF] p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">
                  Ujian untuk NIS {submittedNotice.session.nis} sudah dikumpulkan.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Sesi yang telah dikumpulkan dikunci dan tidak dapat dikerjakan ulang.
                </p>
                {submittedNotice.result && (
                  <button
                    type="button"
                    onClick={() =>
                      onViewSubmittedResult(submittedNotice.result!, submittedNotice.session)
                    }
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Lihat Hasil Ujian Anda
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isChecking}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60 cursor-pointer"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memeriksa Sesi...
                </>
              ) : (
                <>
                  Mulai Ulangan
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Modal Sesi Ditemukan (Resume Sesi) */}
      {foundSession && foundStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">SESI UJIAN DITEMUKAN</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Data jawaban dan waktu pengerjaan sebelumnya berhasil ditemukan.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-[#F3F4F6]/60 p-3.5 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Peserta</span>
                <span className="font-semibold text-slate-900">{foundStudent.nama}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">NIS / Kelas</span>
                <span className="font-mono-tabular text-slate-800">
                  {foundStudent.nis} · {foundStudent.kelas}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Soal Terjawab</span>
                <span className="font-mono-tabular font-semibold text-[#16A34A]">
                  {answeredCount} / {foundSession.urutanSoal.length}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Sisa Waktu</span>
                <span className="font-mono-tabular font-semibold text-[#2563EB]">
                  {String(remainingMinutes).padStart(2, '0')}:
                  {String(remainingSeconds).padStart(2, '0')}
                </span>
              </div>
            </div>

            {showSessionInfo && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-[#EFF6FF] p-3.5 text-xs text-slate-700 space-y-1">
                <p>
                  <span className="font-semibold">ID Sesi:</span>{' '}
                  <span className="font-mono-tabular">{foundSession.sessionId}</span>
                </p>
                <p>
                  <span className="font-semibold">Waktu Mulai:</span>{' '}
                  {new Date(foundSession.waktuMulai).toLocaleString('id-ID')}
                </p>
                <p>
                  <span className="font-semibold">Nomor Soal Terakhir:</span> Soal{' '}
                  {foundSession.nomorAktif}
                </p>
                <p>
                  <span className="font-semibold">Pelanggaran Tab Tercatat:</span>{' '}
                  {foundSession.pelanggaranTab.length} kali
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const s = foundSession;
                  setFoundSession(null);
                  onResumeSession(s);
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                LANJUTKAN PENGERJAAN
              </button>

              <button
                type="button"
                onClick={() => setShowSessionInfo((v) => !v)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {showSessionInfo ? 'SEMBUNYIKAN INFORMASI SESI' : 'LIHAT INFORMASI SESI'}
              </button>

              {settings.izinkanSesiBaru && (
                <button
                  type="button"
                  onClick={() => {
                    const st = foundStudent;
                    setFoundSession(null);
                    onStartNewSession(st);
                  }}
                  className="w-full min-h-[40px] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-100 cursor-pointer"
                >
                  Mulai Sesi Baru (Aturan Guru Mengizinkan)
                </button>
              )}

              <button
                type="button"
                onClick={() => setFoundSession(null)}
                className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
