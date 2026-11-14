import {
  AnswerKeyEntry,
  ExamResult,
  ExamSession,
  ExamSettings,
  Question,
  StudentAnswerValue,
} from '../types/exam';

/**
 * Fisher-Yates shuffle yang adil dan deterministik per sesi.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Normalisasi jawaban isian singkat:
 * Mendukung variasi spasi, huruf kapital, tanda minus unicode (−) atau hyphen (-),
 * tanda plus (+), koma atau titik desimal, serta satuan opsional (kJ, kJ/mol, %).
 */
function normalizeShortAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/−/g, '-') // unicode minus to ascii hyphen
    .replace(/,/g, '.') // decimal comma to dot
    .replace(/\s+/g, ''); // strip spaces
}

function stripUnits(normalized: string): string {
  return normalized.replace(/(kj\/mol|kj|%)+$/i, '');
}

export function isStudentAnswerEmpty(ans: StudentAnswerValue): boolean {
  if (ans === undefined || ans === null) return true;
  if (typeof ans === 'string') return ans.trim().length === 0;
  if (Array.isArray(ans)) return ans.length === 0;
  return false;
}

export function evaluateSingleQuestion(
  question: Question,
  key: AnswerKeyEntry | undefined,
  studentAns: StudentAnswerValue
): { isCorrect: boolean; isEmpty: boolean; earnedPoints: number; maxPoints: number } {
  const maxPoints = key?.points ?? (question.type === 'multiple' || question.type === 'short' ? 4 : 3);
  const isEmpty = isStudentAnswerEmpty(studentAns);

  if (isEmpty || !key) {
    return { isCorrect: false, isEmpty, earnedPoints: 0, maxPoints };
  }

  let isCorrect = false;

  if (question.type === 'single') {
    isCorrect = typeof studentAns === 'number' && studentAns === key.correctIndex;
  } else if (question.type === 'multiple') {
    const expected = [...(key.correctIndices || [])].sort((a, b) => a - b);
    const actual = Array.isArray(studentAns) ? [...studentAns].map(Number).sort((a, b) => a - b) : [];
    // Harus sesuai seluruh kombinasi jawaban benar tanpa pilihan salah atau kekurangan pilihan
    isCorrect =
      expected.length > 0 &&
      expected.length === actual.length &&
      expected.every((val, idx) => val === actual[idx]);
  } else if (question.type === 'boolean') {
    isCorrect = typeof studentAns === 'boolean' && studentAns === key.correctBoolean;
  } else if (question.type === 'short') {
    const normStudent = normalizeShortAnswer(String(studentAns));
    const normStudentNoUnit = stripUnits(normStudent);
    const accepted = key.acceptedAnswers || [];
    isCorrect = accepted.some((candidate) => {
      const normCand = normalizeShortAnswer(candidate);
      const normCandNoUnit = stripUnits(normCand);
      if (normStudent === normCand) return true;
      // Allow numeric equivalence for +33 vs 33, -726.0 vs -726, etc.
      if (normStudentNoUnit === normCandNoUnit) return true;
      const numStudent = Number(normStudentNoUnit);
      const numCand = Number(normCandNoUnit);
      if (
        normStudentNoUnit !== '' &&
        normCandNoUnit !== '' &&
        !Number.isNaN(numStudent) &&
        !Number.isNaN(numCand)
      ) {
        return Math.abs(numStudent - numCand) < 1e-6;
      }
      return false;
    });
  }

  return {
    isCorrect,
    isEmpty: false,
    earnedPoints: isCorrect ? maxPoints : 0,
    maxPoints,
  };
}

/**
 * Hitung sanksi pelanggaran tab berdasarkan aturan tingkat tertinggi yang tercapai.
 * Tingkat 1 = -10 poin, Tingkat 2 = -20 poin, Tingkat 3 = Diskualifikasi.
 */
export function computePenaltyFromViolations(
  violationCount: number,
  settings: ExamSettings
): { highestTier: 0 | 1 | 2 | 3; penaltyPoints: number; disqualified: boolean } {
  if (!settings.sanksiTabAktif || violationCount <= 0) {
    return { highestTier: 0, penaltyPoints: 0, disqualified: false };
  }
  if (violationCount >= settings.batasDiskualifikasi) {
    return {
      highestTier: 3,
      penaltyPoints: settings.sanksiTingkat2,
      disqualified: true,
    };
  }
  if (violationCount === 2) {
    return {
      highestTier: 2,
      penaltyPoints: settings.sanksiTingkat2,
      disqualified: false,
    };
  }
  return {
    highestTier: 1,
    penaltyPoints: settings.sanksiTingkat1,
    disqualified: false,
  };
}

export function calculateExamResult(params: {
  session: ExamSession;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
  settings: ExamSettings;
  resultId: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  submittedAt?: number;
}): ExamResult {
  const { session, questions, answerKeys, settings, resultId, syncStatus, submittedAt } = params;

  const keyMap = new Map<number, AnswerKeyEntry>();
  for (const k of answerKeys) {
    keyMap.set(k.questionId, k);
  }

  let poinDiperoleh = 0;
  let poinMaksimal = 0;
  let benar = 0;
  let salah = 0;
  let kosong = 0;

  const questionBreakdown: ExamResult['questionBreakdown'] = [];

  for (const q of questions) {
    const key = keyMap.get(q.id);
    const ans = session.jawaban[q.id] ?? null;
    const evalRes = evaluateSingleQuestion(q, key, ans);

    poinMaksimal += evalRes.maxPoints;
    poinDiperoleh += evalRes.earnedPoints;

    if (evalRes.isEmpty) {
      kosong += 1;
    } else if (evalRes.isCorrect) {
      benar += 1;
    } else {
      salah += 1;
    }

    questionBreakdown.push({
      questionId: q.id,
      studentAnswer: ans,
      isCorrect: evalRes.isCorrect,
      isEmpty: evalRes.isEmpty,
      earnedPoints: evalRes.earnedPoints,
      maxPoints: evalRes.maxPoints,
    });
  }

  // Nilai mentah skala 0-100 (normalisasi proporsional jika total bobot != 100)
  const nilaiMentah = settings.normalisasiSkor100
    ? poinMaksimal > 0
      ? Math.round((poinDiperoleh / poinMaksimal) * 100)
      : 0
    : Math.min(100, poinDiperoleh);

  const { penaltyPoints, disqualified } = computePenaltyFromViolations(
    session.pelanggaranTab.length,
    settings
  );

  const nilaiAkhir = Math.max(0, nilaiMentah - penaltyPoints);
  const kkm = settings.kkm;
  const statusKelulusan: ExamResult['statusKelulusan'] = disqualified
    ? 'DISKUALIFIKASI'
    : nilaiAkhir >= kkm
      ? 'LULUS'
      : 'REMIDIAL';

  return {
    resultId,
    sessionId: session.sessionId,
    examId: session.examId,
    nis: session.nis,
    nama: session.nama,
    kelas: session.kelas,
    nilai: nilaiAkhir,
    nilaiMentah,
    poinDiperoleh,
    poinMaksimal,
    sanksiPoin: penaltyPoints,
    diskualifikasi: disqualified,
    kkm,
    statusKelulusan,
    benar,
    salah,
    kosong,
    jumlahPelanggaran: session.pelanggaranTab.length,
    pelanggaranDetail: session.pelanggaranTab,
    statusPengumpulan: 'submitted',
    statusSinkronisasi: syncStatus,
    waktuMulai: session.waktuMulai,
    waktuPengumpulan: submittedAt ?? Date.now(),
    jawaban: { ...session.jawaban },
    questionBreakdown,
  };
}
