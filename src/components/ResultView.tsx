import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Download,
  Home,
  Printer,
  RefreshCw,
  ShieldX,
  XCircle,
} from 'lucide-react';
import { AnswerKeyEntry, ExamResult, ExamSettings, Question } from '../types/exam';
import { downloadStudentPDF } from '../services/exportService';

interface ResultViewProps {
  result: ExamResult;
  settings: ExamSettings;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
  onRetrySync: () => Promise<void>;
  onReturnHome: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  settings,
  questions,
  answerKeys,
  onRetrySync,
  onReturnHome,
}) => {
  const [showSummary, setShowSummary] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const keyMap = new Map<number, AnswerKeyEntry>();
  for (const k of answerKeys) keyMap.set(k.questionId, k);

  const isDisqualified = result.diskualifikasi || result.statusKelulusan === 'DISKUALIFIKASI';
  const isPassed = !isDisqualified && result.statusKelulusan === 'LULUS';

  const statusColors = isDisqualified
    ? 'border-red-300 bg-red-50 text-[#DC2626]'
    : isPassed
      ? 'border-emerald-300 bg-emerald-50 text-[#16A34A]'
      : 'border-red-300 bg-red-50 text-[#DC2626]';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        {/* Header Status */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
              Hasil Ulangan Harian Online
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{result.nama}</h1>
            <p className="mt-1 text-sm text-slate-600">
              NIS {result.nis} · Kelas {result.kelas} · {settings.mataPelajaran} ({settings.materi})
            </p>
          </div>

          <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${statusColors}`}>
            {isDisqualified ? (
              <ShieldX className="h-5 w-5 shrink-0" />
            ) : isPassed ? (
              <Award className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{result.statusKelulusan}</span>
          </div>
        </div>

        {/* Status Sinkronisasi Jujur */}
        <div
          className={`mt-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            result.statusSinkronisasi === 'synced'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
              : result.statusSinkronisasi === 'failed'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2.5 text-sm">
            {result.statusSinkronisasi === 'synced' ? (
              <CheckCircle2 className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
            ) : (
              <CloudOff className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {result.statusSinkronisasi === 'synced'
                  ? 'TERSINKRONISASI — Data hasil telah diterima Firebase Realtime Database'
                  : 'TERSIMPAN DI PERANGKAT — BELUM SINKRON'}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                {result.statusSinkronisasi === 'synced'
                  ? `ID Pengumpulan: ${result.resultId} · Waktu: ${new Date(
                      result.waktuPengumpulan
                    ).toLocaleString('id-ID')}`
                  : result.syncError
                    ? `Alasan tertunda: ${result.syncError}. Jawaban tetap aman di perangkat dan akan dikirim otomatis saat koneksi Firebase tersedia.`
                    : 'Hasil tersimpan aman secara lokal di perangkat Anda dan akan dikirim otomatis ketika koneksi internet & Firebase sekolah tersambung.'}
              </p>
            </div>
          </div>

          {result.statusSinkronisasi !== 'synced' && (
            <button
              type="button"
              disabled={syncingNow}
              onClick={async () => {
                setSyncingNow(true);
                try {
                  await onRetrySync();
                } finally {
                  setSyncingNow(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-50 shrink-0 cursor-pointer no-print"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
              Sinkronkan Sekarang
            </button>
          )}
        </div>

        {/* Kartu Statistik Nilai */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-[#EFF6FF]/60 p-4">
            <p className="text-xs font-medium text-slate-600">Nilai Akhir</p>
            <p className="mt-1 text-3xl font-bold text-[#2563EB] font-mono-tabular">
              {result.nilai}
            </p>
            <p className="mt-1 text-xs text-slate-500">KKM: {result.kkm}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-600">Jawaban Benar</p>
            <p className="mt-1 text-3xl font-bold text-[#16A34A] font-mono-tabular">
              {result.benar}
            </p>
            <p className="mt-1 text-xs text-slate-500">dari {questions.length} soal</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-600">Salah / Kosong</p>
            <p className="mt-1 text-3xl font-bold text-slate-800 font-mono-tabular">
              {result.salah}{' '}
              <span className="text-lg font-medium text-slate-400">/ {result.kosong}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Salah / Tidak dijawab</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-600">Pelanggaran Tab</p>
            <p
              className={`mt-1 text-3xl font-bold font-mono-tabular ${
                result.jumlahPelanggaran > 0 ? 'text-[#DC2626]' : 'text-slate-800'
              }`}
            >
              {result.jumlahPelanggaran}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {result.sanksiPoin > 0 ? `Potongan: −${result.sanksiPoin} poin` : 'Tanpa potongan'}
            </p>
          </div>
        </div>

        {isDisqualified && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-[#DC2626]">
            <strong>Status Diskualifikasi:</strong> Ujian ditandai tidak sah karena pelanggaran perpindahan tab mencapai batas tingkat 3 ({result.jumlahPelanggaran} kali). Hubungi guru mata pelajaran untuk tindak lanjut.
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="mt-6 flex flex-wrap items-center gap-3 no-print">
          <button
            type="button"
            onClick={() => setShowSummary((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            {showSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Lihat Ringkasan Jawaban
          </button>

          <button
            type="button"
            onClick={() =>
              downloadStudentPDF({
                result,
                settings,
                questions,
                answerKeys,
                includeExplanations: settings.tampilkanPembahasan,
              })
            }
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Unduh PDF Hasil
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Cetak Hasil
          </button>

          {settings.izinkanKembaliBeranda && (
            <button
              type="button"
              onClick={onReturnHome}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ml-auto cursor-pointer"
            >
              <Home className="h-4 w-4" />
              Kembali ke Halaman Utama
            </button>
          )}
        </div>

        {/* Ringkasan Jawaban & Pembahasan (Jika Diaktifkan Guru) */}
        {showSummary && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Ringkasan Jawaban Anda</h2>
              <span className="text-xs text-slate-500">
                {settings.tampilkanPembahasan
                  ? 'Pembahasan diaktifkan oleh guru'
                  : 'Pembahasan soal dinonaktifkan oleh guru'}
              </span>
            </div>

            <div className="space-y-4">
              {questions.map((q) => {
                const breakdown = result.questionBreakdown?.find((b) => b.questionId === q.id);
                const key = keyMap.get(q.id);
                const ans = result.jawaban?.[q.id];

                let readableAns = '(Tidak dijawab)';
                if (q.type === 'single' && typeof ans === 'number' && q.options) {
                  readableAns = `${String.fromCharCode(65 + ans)}. ${q.options[ans] ?? ''}`;
                } else if (q.type === 'multiple' && Array.isArray(ans) && ans.length > 0 && q.options) {
                  readableAns = ans
                    .slice()
                    .sort((a, b) => a - b)
                    .map((i) => `${String.fromCharCode(65 + i)}. ${q.options?.[i] ?? ''}`)
                    .join(' | ');
                } else if (q.type === 'boolean' && typeof ans === 'boolean') {
                  const labels = q.options || ['Benar', 'Salah'];
                  readableAns = ans ? labels[0] : labels[1];
                } else if (q.type === 'short' && typeof ans === 'string' && ans.trim() !== '') {
                  readableAns = ans;
                }

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">
                        Soal {q.id}{' '}
                        <span className="font-normal text-slate-500">
                          (
                          {q.type === 'single'
                            ? 'Pilihan Ganda'
                            : q.type === 'multiple'
                              ? 'PG Kompleks'
                              : q.type === 'boolean'
                                ? 'Benar-Salah'
                                : 'Isian Singkat'}
                          )
                        </span>
                      </p>
                      {breakdown && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                            breakdown.isEmpty
                              ? 'text-slate-500'
                              : breakdown.isCorrect
                                ? 'text-[#16A34A]'
                                : 'text-[#DC2626]'
                          }`}
                        >
                          {breakdown.isEmpty ? (
                            'Kosong'
                          ) : breakdown.isCorrect ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Benar (+{breakdown.earnedPoints})
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" /> Salah (0)
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-slate-700 whitespace-pre-line">{q.prompt}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Jawaban Anda:</span>{' '}
                      {readableAns}
                    </p>

                    {settings.tampilkanPembahasan && key && (
                      <div className="mt-3 rounded-lg bg-[#EFF6FF] p-3 text-xs text-slate-800">
                        <p className="font-semibold text-[#2563EB]">Pembahasan:</p>
                        <p className="mt-1 leading-relaxed">{key.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
