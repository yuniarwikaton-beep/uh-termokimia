import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Maximize2,
  Minimize2,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { GENERAL_INSTRUCTIONS } from '../data/questions';
import { isStudentAnswerEmpty } from '../services/scoring';
import {
  ExamSession,
  ExamSettings,
  Question,
  StudentAnswerValue,
  SyncStatusType,
  ViolationRecord,
} from '../types/exam';
import { SyncStatusBadge } from './SyncStatusBadge';

interface ExamViewProps {
  session: ExamSession;
  questions: Question[];
  settings: ExamSettings;
  syncStatus: SyncStatusType;
  pendingCount: number;
  firebaseConfigured: boolean;
  onSessionChange: (updated: ExamSession, immediateSync?: boolean) => void;
  onSubmitExam: (finalSession: ExamSession, autoExpired?: boolean) => Promise<void>;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSectionLabel(originalId: number): string {
  if (originalId <= 9) return GENERAL_INSTRUCTIONS.sectionHeaders.A;
  if (originalId <= 17) return GENERAL_INSTRUCTIONS.sectionHeaders.B;
  if (originalId <= 25) return GENERAL_INSTRUCTIONS.sectionHeaders.C;
  return GENERAL_INSTRUCTIONS.sectionHeaders.D;
}

function getQuestionTypeLabel(type: Question['type']): string {
  switch (type) {
    case 'single':
      return 'Pilihan Ganda';
    case 'multiple':
      return 'Pilihan Ganda Kompleks (Pilih semua yang benar)';
    case 'boolean':
      return 'Benar - Salah';
    case 'short':
      return 'Isian Singkat';
  }
}

export const ExamView: React.FC<ExamViewProps> = ({
  session,
  questions,
  settings,
  syncStatus,
  pendingCount,
  firebaseConfigured,
  onSessionChange,
  onSubmitExam,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, session.batasWaktu - Date.now())
  );
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const warnedMarksRef = useRef<Set<number>>(new Set());

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [hasEnteredFullscreenOnce, setHasEnteredFullscreenOnce] = useState<boolean>(() =>
    Boolean(document.fullscreenElement)
  );
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const [violationModal, setViolationModal] = useState<{
    tier: 1 | 2 | 3;
    count: number;
  } | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionRef = useRef<ExamSession>(session);
  sessionRef.current = session;

  const lastViolationTsRef = useRef<number>(0);
  const autoSubmittedRef = useRef<boolean>(false);

  const questionMap = useMemo(() => {
    const map = new Map<number, Question>();
    for (const q of questions) map.set(q.id, q);
    return map;
  }, [questions]);

  const orderedQuestionIds = useMemo(() => {
    if (session.urutanSoal && session.urutanSoal.length > 0) {
      return session.urutanSoal;
    }
    return questions.map((q) => q.id);
  }, [session.urutanSoal, questions]);

  const activeDisplayIndex = Math.min(
    Math.max(1, session.nomorAktif || 1),
    orderedQuestionIds.length
  );
  const activeOriginalId = orderedQuestionIds[activeDisplayIndex - 1];
  const currentQuestion = questionMap.get(activeOriginalId) || questions[0];

  // Hitung statistik navigasi
  const navStats = useMemo(() => {
    let answered = 0;
    let flagged = 0;
    let unanswered = 0;
    for (const qId of orderedQuestionIds) {
      const isFlagged = Boolean(session.soalRaguRagu[qId]);
      const isEmpty = isStudentAnswerEmpty(session.jawaban[qId] ?? null);
      if (isFlagged) flagged += 1;
      if (isEmpty) unanswered += 1;
      else answered += 1;
    }
    return { answered, flagged, unanswered };
  }, [orderedQuestionIds, session.jawaban, session.soalRaguRagu]);

  const violationQuestionSet = useMemo(() => {
    const s = new Set<number>();
    for (const v of session.pelanggaranTab || []) {
      s.add(v.questionNumber);
    }
    return s;
  }, [session.pelanggaranTab]);

  // Timer berbasis timestamp (batasWaktu - Date.now()), tidak pernah reset saat reload
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, sessionRef.current.batasWaktu - Date.now());
      setRemainingMs(left);

      const minsLeft = Math.ceil(left / 60000);
      if (left > 0) {
        if (left <= 60 * 1000 && !warnedMarksRef.current.has(1)) {
          warnedMarksRef.current.add(1);
          setTimeWarning('Peringatan Waktu: Sisa waktu pengerjaan kurang dari 1 menit!');
        } else if (left <= 5 * 60 * 1000 && left > 60 * 1000 && !warnedMarksRef.current.has(5)) {
          warnedMarksRef.current.add(5);
          setTimeWarning('Peringatan Waktu: Sisa waktu pengerjaan tinggal 5 menit.');
        } else if (
          left <= 10 * 60 * 1000 &&
          left > 5 * 60 * 1000 &&
          !warnedMarksRef.current.has(10)
        ) {
          warnedMarksRef.current.add(10);
          setTimeWarning('Peringatan Waktu: Sisa waktu pengerjaan tinggal 10 menit.');
        } else if (minsLeft > 10) {
          setTimeWarning(null);
        }
      }

      if (left <= 0 && !autoSubmittedRef.current && sessionRef.current.status !== 'submitted') {
        autoSubmittedRef.current = true;
        setIsSubmitting(true);
        onSubmitExam(sessionRef.current, true).finally(() => setIsSubmitting(false));
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [onSubmitExam]);

  // Periodic auto-save heartbeat tiap 15 detik
  useEffect(() => {
    const hb = window.setInterval(() => {
      if (sessionRef.current.status === 'submitted') return;
      onSessionChange({ ...sessionRef.current, lastUpdatedAt: Date.now() }, false);
    }, 15000);
    return () => window.clearInterval(hb);
  }, [onSessionChange]);

  // Fullscreen listener
  const enterFullscreen = useCallback(async () => {
    setFullscreenError(null);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setHasEnteredFullscreenOnce(true);
      onSessionChange(
        { ...sessionRef.current, fullscreenAktif: true, lastUpdatedAt: Date.now() },
        false
      );
    } catch {
      setFullscreenError(
        'Browser menolak mode fullscreen otomatis. Pastikan Anda mengklik tombol "Masuk Fullscreen" langsung atau izinkan fullscreen pada pengaturan browser.'
      );
    }
  }, [onSessionChange]);

  useEffect(() => {
    const handleFsChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (fs) {
        setHasEnteredFullscreenOnce(true);
        onSessionChange(
          { ...sessionRef.current, fullscreenAktif: true, lastUpdatedAt: Date.now() },
          false
        );
      } else if (hasEnteredFullscreenOnce && sessionRef.current.status !== 'submitted') {
        onSessionChange(
          {
            ...sessionRef.current,
            fullscreenAktif: false,
            pelanggaranFullscreen: (sessionRef.current.pelanggaranFullscreen || 0) + 1,
            lastUpdatedAt: Date.now(),
          },
          true
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [hasEnteredFullscreenOnce, onSessionChange]);

  // Tab switch & visibility detection (3-tier penalty dengan dedupe 1800ms)
  useEffect(() => {
    if (!settings.sanksiTabAktif) return;

    const recordTabViolation = (source: 'tab_switch' | 'window_blur') => {
      const current = sessionRef.current;
      if (current.status === 'submitted') return;
      // Abaikan jika siswa belum masuk fullscreen wajib (agar tombol masuk fullscreen awal tidak memicu pelanggaran)
      if (settings.wajibFullscreen && !hasEnteredFullscreenOnce) return;

      const now = Date.now();
      if (now - lastViolationTsRef.current < 1800) {
        // Cegah sanksi berulang akibat event visibilitychange + blur yang terpicu bersamaan
        return;
      }
      lastViolationTsRef.current = now;

      const nextCount = (current.pelanggaranTab?.length || 0) + 1;
      const tier: 1 | 2 | 3 = nextCount >= settings.batasDiskualifikasi ? 3 : nextCount === 2 ? 2 : 1;

      const newRecord: ViolationRecord = {
        id: `viol_${now}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        type: source,
        questionNumber: current.urutanSoal[(current.nomorAktif || 1) - 1] || 1,
        tier,
        description:
          source === 'tab_switch'
            ? 'Meninggalkan tab ujian (Visibility API: hidden)'
            : 'Jendela browser ujian kehilangan fokus (Window Blur)',
      };

      const nextTier = Math.max(current.sanksiTingkatTertinggi || 0, tier) as 0 | 1 | 2 | 3;
      const updatedSession: ExamSession = {
        ...current,
        pelanggaranTab: [...(current.pelanggaranTab || []), newRecord],
        sanksiTingkatTertinggi: nextTier,
        lastUpdatedAt: now,
      };

      onSessionChange(updatedSession, true);
      setViolationModal({ tier, count: nextCount });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordTabViolation('tab_switch');
      }
    };

    const handleBlur = () => {
      // Hanya catat blur bila dokumen bukan sedang meminta dialog sistem / masih terlihat terpisah
      if (document.visibilityState === 'visible') {
        recordTabViolation('window_blur');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    settings.sanksiTabAktif,
    settings.batasDiskualifikasi,
    settings.wajibFullscreen,
    hasEnteredFullscreenOnce,
    onSessionChange,
  ]);

  const updateAnswer = (qId: number, value: StudentAnswerValue, immediate = true) => {
    const updated: ExamSession = {
      ...session,
      jawaban: {
        ...session.jawaban,
        [qId]: value,
      },
      lastUpdatedAt: Date.now(),
    };
    onSessionChange(updated, immediate);
  };

  const toggleFlag = (qId: number) => {
    const updated: ExamSession = {
      ...session,
      soalRaguRagu: {
        ...session.soalRaguRagu,
        [qId]: !session.soalRaguRagu[qId],
      },
      lastUpdatedAt: Date.now(),
    };
    onSessionChange(updated, true);
  };

  const goToDisplayIndex = (newDisplayIndex: number) => {
    const clamped = Math.min(Math.max(1, newDisplayIndex), orderedQuestionIds.length);
    const updated: ExamSession = {
      ...session,
      nomorAktif: clamped,
      lastUpdatedAt: Date.now(),
    };
    onSessionChange(updated, true);
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmitExam(session, false);
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  // Urutan opsi (default asli kecuali acakOpsi diaktifkan guru)
  const displayOptionIndices = useMemo(() => {
    if (!currentQuestion.options) return [];
    const customOrder = session.opsiOrder?.[currentQuestion.id];
    if (customOrder && customOrder.length === currentQuestion.options.length) {
      return customOrder;
    }
    return currentQuestion.options.map((_, idx) => idx);
  }, [currentQuestion, session.opsiOrder]);

  const currentAnswer = session.jawaban[currentQuestion.id] ?? null;
  const isCurrentFlagged = Boolean(session.soalRaguRagu[currentQuestion.id]);

  const isLowTime = remainingMs <= 5 * 60 * 1000;

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col">
      {/* Header Ujian */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {session.nama}{' '}
              <span className="font-mono-tabular font-normal text-slate-500">
                ({session.nis} · {session.kelas})
              </span>
            </p>
            <p className="text-xs text-slate-600">
              {settings.mataPelajaran} · Materi: {settings.materi}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <SyncStatusBadge
              status={syncStatus}
              pendingCount={pendingCount}
              firebaseConfigured={firebaseConfigured}
            />

            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono-tabular text-base font-bold ${
                isLowTime
                  ? 'border-red-300 bg-red-50 text-[#DC2626]'
                  : 'border-blue-200 bg-[#EFF6FF] text-[#2563EB]'
              }`}
              aria-live="polite"
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formatCountdown(remainingMs)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isFullscreen) {
                  document.exitFullscreen?.().catch(() => {});
                } else {
                  enterFullscreen();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              title={isFullscreen ? 'Keluar Fullscreen' : 'Masuk Fullscreen'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Keluar Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Masuk Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Peringatan Sisa Waktu (10, 5, 1 menit) */}
      {timeWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-amber-900">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            {timeWarning}
          </span>
        </div>
      )}

      {/* Konten Utama: Area Soal + Sidebar Nomor Soal */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Area Soal Utama */}
          <section className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
            {/* Metadata Bagian & Nomor Soal */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#2563EB]">
                  {getSectionLabel(currentQuestion.id)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-bold text-slate-900 text-base">
                    Soal No. {activeDisplayIndex}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{getQuestionTypeLabel(currentQuestion.type)}</span>
                  {currentQuestion.akmTag && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#2563EB]">
                        [{currentQuestion.akmTag}]
                      </span>
                    </>
                  )}
                </div>
              </div>

              {session.pelanggaranTab.length > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Pelanggaran Tab: {session.pelanggaranTab.length}</span>
                </div>
              )}
            </div>

            {/* Teks / Data Kontekstual AKM jika ada */}
            {(currentQuestion.contextIntro ||
              currentQuestion.contextTitle ||
              currentQuestion.contextBody ||
              currentQuestion.table) && (
              <div className="mt-5 rounded-xl border border-blue-100 bg-[#EFF6FF]/60 p-4 sm:p-5 text-sm text-slate-800 space-y-2.5">
                {currentQuestion.contextIntro && (
                  <p className="text-xs font-semibold text-slate-600">
                    {currentQuestion.contextIntro}
                  </p>
                )}
                {currentQuestion.contextTitle && (
                  <p className="font-bold text-slate-900">{currentQuestion.contextTitle}</p>
                )}
                {currentQuestion.contextBody && (
                  <p className="whitespace-pre-line leading-relaxed text-slate-800">
                    {currentQuestion.contextBody}
                  </p>
                )}
                {currentQuestion.table && (
                  <div className="overflow-x-auto pt-1">
                    <table className="w-full min-w-[380px] border-collapse text-left text-xs sm:text-sm bg-white rounded-lg overflow-hidden border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800">
                          {currentQuestion.table.headers.map((h, i) => (
                            <th key={i} className="border-b border-slate-200 px-3 py-2 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentQuestion.table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b last:border-b-0 border-slate-100">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-3 py-2 text-slate-800 ${
                                  cIdx >= 2 ? 'font-mono-tabular' : ''
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Redaksi Pertanyaan */}
            <div className="mt-6 text-base sm:text-[17px] leading-relaxed text-slate-900 whitespace-pre-line font-medium">
              {currentQuestion.prompt}
            </div>

            {/* Area Input Jawaban Sesuai Tipe Soal */}
            <div className="mt-6 space-y-3">
              {/* 1. Pilihan Ganda (Radio) */}
              {currentQuestion.type === 'single' && currentQuestion.options && (
                <div role="radiogroup" aria-label={`Pilihan soal ${activeDisplayIndex}`} className="space-y-2.5">
                  {displayOptionIndices.map((origIdx, visualIdx) => {
                    const optionText = currentQuestion.options![origIdx];
                    const selected = currentAnswer === origIdx;
                    const letter = String.fromCharCode(65 + visualIdx);
                    return (
                      <label
                        key={origIdx}
                        className={`flex min-h-[48px] items-start gap-3.5 rounded-xl border p-3.5 sm:p-4 cursor-pointer transition ${
                          selected
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-slate-900'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q_${currentQuestion.id}`}
                          checked={selected}
                          onChange={() => updateAnswer(currentQuestion.id, origIdx, true)}
                          className="mt-1 h-4 w-4 text-[#2563EB] focus:ring-[#2563EB] shrink-0"
                        />
                        <span className="font-mono-tabular text-sm font-bold text-slate-500 mt-0.5 shrink-0">
                          {letter}.
                        </span>
                        <span className="text-sm sm:text-base text-slate-800 leading-relaxed">
                          {optionText}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 2. Pilihan Ganda Kompleks (Checkbox) */}
              {currentQuestion.type === 'multiple' && currentQuestion.options && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-slate-500">
                    Anda dapat memilih lebih dari satu jawaban yang benar.
                  </p>
                  {displayOptionIndices.map((origIdx) => {
                    const optionText = currentQuestion.options![origIdx];
                    const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const selected = selectedArr.includes(origIdx);
                    return (
                      <label
                        key={origIdx}
                        className={`flex min-h-[48px] items-start gap-3.5 rounded-xl border p-3.5 sm:p-4 cursor-pointer transition ${
                          selected
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-slate-900'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedArr, origIdx]
                              : selectedArr.filter((i) => i !== origIdx);
                            updateAnswer(currentQuestion.id, next, true);
                          }}
                          className="mt-1 h-4 w-4 rounded text-[#2563EB] focus:ring-[#2563EB] shrink-0"
                        />
                        <span className="text-sm sm:text-base text-slate-800 leading-relaxed">
                          {optionText}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 3. Benar-Salah (Two Options) */}
              {currentQuestion.type === 'boolean' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { val: true, label: currentQuestion.options?.[0] || 'Benar' },
                    { val: false, label: currentQuestion.options?.[1] || 'Salah' },
                  ].map((opt) => {
                    const selected = currentAnswer === opt.val;
                    return (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => updateAnswer(currentQuestion.id, opt.val, true)}
                        className={`flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border px-5 py-3.5 text-base font-semibold transition cursor-pointer ${
                          selected
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {selected && <Check className="h-4 w-4 shrink-0" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Isian Singkat (Text Input) */}
              {currentQuestion.type === 'short' && (
                <div className="rounded-xl border border-slate-200 bg-[#F3F4F6]/40 p-4">
                  <label
                    htmlFor={`short_${currentQuestion.id}`}
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Jawaban Isian Singkat:
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      id={`short_${currentQuestion.id}`}
                      type="text"
                      value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                      onChange={(e) => updateAnswer(currentQuestion.id, e.target.value, false)}
                      onBlur={(e) => updateAnswer(currentQuestion.id, e.target.value, true)}
                      placeholder="Ketik jawaban singkat Anda di sini..."
                      className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 font-mono-tabular"
                    />
                    {currentQuestion.unitSuffix && (
                      <span className="text-sm font-semibold text-slate-600 shrink-0">
                        {currentQuestion.unitSuffix}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Tips: Anda dapat menuliskan tanda negatif (− / -) dan koma atau titik desimal sesuai perhitungan.
                  </p>
                </div>
              )}
            </div>

            {/* Tombol Navigasi Bawah */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
              <button
                type="button"
                disabled={activeDisplayIndex <= 1}
                onClick={() => goToDisplayIndex(activeDisplayIndex - 1)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
                  isCurrentFlagged
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Flag className="h-4 w-4" />
                {isCurrentFlagged ? 'Ditandai Ragu-ragu' : 'Ragu-ragu'}
              </button>

              {activeDisplayIndex < orderedQuestionIds.length ? (
                <button
                  type="button"
                  onClick={() => goToDisplayIndex(activeDisplayIndex + 1)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Selanjutnya
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  KIRIM JAWABAN
                </button>
              )}
            </div>
          </section>

          {/* Sidebar Navigasi Nomor Soal (1-30) */}
          <aside className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Navigasi Nomor Soal</h2>
              <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                {navStats.answered}/{orderedQuestionIds.length}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {orderedQuestionIds.map((origId, idx) => {
                const displayNum = idx + 1;
                const isCurrent = displayNum === activeDisplayIndex;
                const isFlagged = Boolean(session.soalRaguRagu[origId]);
                const isEmpty = isStudentAnswerEmpty(session.jawaban[origId] ?? null);
                const hasViolation = violationQuestionSet.has(origId);

                let btnClasses =
                  'border-slate-200 bg-[#F3F4F6] text-slate-700 hover:bg-slate-200/80';
                if (hasViolation && isEmpty && !isFlagged) {
                  btnClasses = 'border-red-300 bg-red-50 text-[#DC2626] hover:bg-red-100';
                } else if (isFlagged) {
                  btnClasses = 'border-amber-400 bg-[#EAB308] text-slate-950 hover:bg-yellow-500';
                } else if (!isEmpty) {
                  btnClasses = 'border-green-600 bg-[#16A34A] text-white hover:bg-green-700';
                }

                return (
                  <button
                    key={origId}
                    type="button"
                    onClick={() => goToDisplayIndex(displayNum)}
                    className={`relative flex h-10 w-full items-center justify-center rounded-lg border text-sm font-bold font-mono-tabular transition cursor-pointer ${btnClasses} ${
                      isCurrent ? 'ring-2 ring-[#2563EB] ring-offset-2' : ''
                    }`}
                    aria-label={`Soal ${displayNum}`}
                  >
                    {displayNum}
                    {hasViolation && (
                      <span
                        className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#DC2626] ring-2 ring-white"
                        title="Terjadi pelanggaran tab saat mengerjakan soal ini"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda Warna */}
            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Keterangan Indikator:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#16A34A] shrink-0" />
                  <span>Sudah dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#F3F4F6] border border-slate-300 shrink-0" />
                  <span>Belum dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#EAB308] shrink-0" />
                  <span>Ragu-ragu</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#DC2626] shrink-0" />
                  <span>Pelanggaran tab</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="mt-5 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              KIRIM JAWABAN
            </button>
          </aside>
        </div>
      </main>

      {/* Gate Fullscreen Awal atau Peringatan Keluar Fullscreen */}
      {settings.wajibFullscreen && !isFullscreen && !violationModal && !showSubmitModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#2563EB]">
              <Maximize2 className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                {hasEnteredFullscreenOnce
                  ? 'Anda Keluar dari Mode Fullscreen'
                  : 'Aktifkan Mode Fullscreen Ujian'}
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {hasEnteredFullscreenOnce
                ? `Kejadian keluar fullscreen telah dicatat (${session.pelanggaranFullscreen || 1} kali). Sesuai kebijakan ujian, silakan kembali ke mode fullscreen untuk melanjutkan pengerjaan.`
                : 'Untuk menjaga fokus pengerjaan ujian di Chromebook maupun laptop, klik tombol di bawah untuk mengaktifkan layar penuh (Fullscreen API browser).'}
            </p>
            {fullscreenError && (
              <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-[#DC2626]">
                {fullscreenError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full min-h-[46px] rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Masuk Fullscreen
              </button>
              {fullscreenError && (
                <button
                  type="button"
                  onClick={() => setHasEnteredFullscreenOnce(true)}
                  className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Lanjutkan sementara tanpa fullscreen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Peringatan Sanksi Perpindahan Tab */}
      {violationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <AlertOctagon className="h-7 w-7 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">
                  Pelanggaran Tingkat {violationModal.tier}
                </p>
                <h3 className="text-lg font-bold text-slate-900">
                  {violationModal.tier === 3
                    ? 'STATUS: DISKUALIFIKASI'
                    : violationModal.tier === 2
                      ? 'Peringatan Serius Perpindahan Tab'
                      : 'Peringatan Perpindahan Tab'}
                </h3>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900 space-y-1.5">
              <p>
                Sistem mendeteksi Anda meninggalkan halaman ujian (pelanggaran ke-
                <span className="font-bold font-mono-tabular">{violationModal.count}</span>).
              </p>
              {violationModal.tier === 1 && (
                <p className="font-semibold">
                  Sanksi Tingkat 1: Pengurangan nilai sebesar {settings.sanksiTingkat1} poin.
                </p>
              )}
              {violationModal.tier === 2 && (
                <p className="font-semibold">
                  Sanksi Tingkat 2: Pengurangan nilai sebesar {settings.sanksiTingkat2} poin. Satu pelanggaran lagi akan mengakibatkan DISKUALIFIKASI.
                </p>
              )}
              {violationModal.tier === 3 && (
                <p className="font-semibold">
                  Sanksi Tingkat 3: Ujian Anda ditandai DISKUALIFIKASI dan riwayat pelanggaran tercatat untuk diperiksa guru.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViolationModal(null)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pengumpulan Ujian */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Apakah Anda yakin ingin mengumpulkan ujian?
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Setelah dikumpulkan, seluruh jawaban Anda akan dikunci dan tidak dapat diubah kembali.
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-[#F3F4F6]/60 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Sudah dijawab</span>
                <span className="font-bold font-mono-tabular text-[#16A34A]">
                  {navStats.answered} soal
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Belum dijawab</span>
                <span className="font-bold font-mono-tabular text-slate-800">
                  {navStats.unanswered} soal
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ditandai ragu-ragu</span>
                <span className="font-bold font-mono-tabular text-amber-600">
                  {navStats.flagged} soal
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Kembali ke Ujian
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="min-h-[44px] rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
