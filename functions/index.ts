import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.database();

/**
 * Validasi Token Ujian dan NIS siswa di sisi server sebelum membuat sesi.
 * Mencegah siswa membaca token atau daftar semua siswa secara langsung.
 */
export const validateExamEntry = onCall(async (request) => {
  const { nis, token, examId = 'termokimia-2026' } = request.data || {};
  if (!nis || !token) {
    throw new HttpsError('invalid-argument', 'NIS dan Token Ujian wajib diisi.');
  }

  const [studentSnap, secretSnap, examSnap] = await Promise.all([
    db.ref(`students/${String(nis).trim()}`).get(),
    db.ref(`examSecrets/${examId}`).get(),
    db.ref(`exams/${examId}`).get(),
  ]);

  if (!studentSnap.exists()) {
    throw new HttpsError('not-found', 'NIS tidak terdaftar pada daftar peserta ujian.');
  }

  const student = studentSnap.val();
  if (student.status !== 'aktif') {
    throw new HttpsError('permission-denied', 'Status peserta siswa tidak aktif.');
  }

  const secret = secretSnap.val();
  if (!secret || String(secret.token).trim().toUpperCase() !== String(token).trim().toUpperCase()) {
    throw new HttpsError('permission-denied', 'Token Ujian tidak sesuai.');
  }

  const exam = examSnap.val();
  const now = Date.now();
  if (exam?.waktuMulaiJadwal && now < exam.waktuMulaiJadwal) {
    throw new HttpsError('failed-precondition', 'Ujian belum dimulai sesuai jadwal guru.');
  }
  if (exam?.waktuSelesaiJadwal && now > exam.waktuSelesaiJadwal) {
    throw new HttpsError('failed-precondition', 'Jadwal ujian telah berakhir.');
  }

  // Terbitkan custom token atau kembalikan konfirmasi sesi yang aman
  return {
    valid: true,
    serverTime: now,
    student: {
      nis: student.nis,
      nama: student.nama,
      kelas: student.kelas,
    },
  };
});

/**
 * Pengumpulan & Penilaian Final Idempoten di Sisi Server.
 * Kunci jawaban hanya dibaca dari `examSecrets/${examId}/answerKeys` oleh Admin SDK.
 */
export const submitExamFinal = onCall(async (request) => {
  const { resultId, sessionId, examId = 'termokimia-2026', nis, answers, violations = [] } = request.data || {};
  if (!resultId || !sessionId || !nis) {
    throw new HttpsError('invalid-argument', 'Data pengumpulan tidak lengkap.');
  }

  const resultRef = db.ref(`results/${resultId}`);
  const existingResult = await resultRef.get();
  if (existingResult.exists()) {
    // Idempotent: jika resultId sudah ada, kembalikan hasil yang sudah sah tanpa duplikasi
    return { idempotent: true, result: existingResult.val() };
  }

  const [sessionSnap, examSnap, secretSnap, studentSnap] = await Promise.all([
    db.ref(`sessions/${sessionId}`).get(),
    db.ref(`exams/${examId}`).get(),
    db.ref(`examSecrets/${examId}`).get(),
    db.ref(`students/${nis}`).get(),
  ]);

  if (!sessionSnap.exists()) {
    throw new HttpsError('not-found', 'Sesi ujian tidak ditemukan.');
  }

  const session = sessionSnap.val();
  if (session.status === 'submitted') {
    throw new HttpsError('already-exists', 'Sesi ujian ini sudah pernah dikumpulkan.');
  }

  const exam = examSnap.val() || { kkm: 78 };
  const secret = secretSnap.val() || {};
  const answerKeys = secret.answerKeys || {};
  const student = studentSnap.val() || { nama: session.nama || nis, kelas: session.kelas || '-' };

  let rawEarned = 0;
  let rawMax = 0;
  let benar = 0;
  let salah = 0;
  let kosong = 0;

  for (const [qNumStr, keyDef] of Object.entries<any>(answerKeys)) {
    const points = Number(keyDef.points || 3);
    rawMax += points;
    const studentAns = answers?.[qNumStr];

    const isEmpty =
      studentAns === undefined ||
      studentAns === null ||
      studentAns === '' ||
      (Array.isArray(studentAns) && studentAns.length === 0);

    if (isEmpty) {
      kosong += 1;
      continue;
    }

    let isCorrect = false;
    if (keyDef.type === 'single') {
      isCorrect = Number(studentAns) === Number(keyDef.correctIndex);
    } else if (keyDef.type === 'multiple') {
      const expected = [...(keyDef.correctIndices || [])].map(Number).sort((a, b) => a - b);
      const actual = [...(Array.isArray(studentAns) ? studentAns : [])].map(Number).sort((a, b) => a - b);
      isCorrect = expected.length === actual.length && expected.every((v, i) => v === actual[i]);
    } else if (keyDef.type === 'boolean') {
      isCorrect = Boolean(studentAns) === Boolean(keyDef.correctBoolean);
    } else if (keyDef.type === 'short') {
      const norm = String(studentAns).trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
      const accepted = (keyDef.acceptedAnswers || []).map((a: string) =>
        String(a).trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
      );
      isCorrect = accepted.includes(norm);
    }

    if (isCorrect) {
      benar += 1;
      rawEarned += points;
    } else {
      salah += 1;
    }
  }

  const normalizedScore = rawMax > 0 ? Math.round((rawEarned / rawMax) * 100) : 0;
  const violationCount = Array.isArray(violations) ? violations.length : 0;
  const disqualified = violationCount >= 3;
  const penalty = violationCount >= 2 ? 20 : violationCount === 1 ? 10 : 0;
  const finalScore = Math.max(0, normalizedScore - penalty);
  const kkm = Number(exam.kkm ?? 78);
  const statusKelulusan = disqualified ? 'DISKUALIFIKASI' : finalScore >= kkm ? 'LULUS' : 'REMIDIAL';

  const resultPayload = {
    resultId,
    sessionId,
    examId,
    nis,
    nama: student.nama,
    kelas: student.kelas,
    nilai: finalScore,
    nilaiMentah: normalizedScore,
    sanksiPoin: penalty,
    diskualifikasi: disqualified,
    kkm,
    statusKelulusan,
    benar,
    salah,
    kosong,
    jumlahPelanggaran: violationCount,
    statusPengumpulan: 'submitted',
    statusSinkronisasi: 'synced',
    waktuPengumpulan: admin.database.ServerValue.TIMESTAMP,
    jawaban: answers || {},
  };

  await resultRef.set(resultPayload);
  await db.ref(`sessions/${sessionId}`).update({
    status: 'submitted',
    submittedAt: admin.database.ServerValue.TIMESTAMP,
    lastUpdatedAt: admin.database.ServerValue.TIMESTAMP,
  });

  return { idempotent: false, result: resultPayload };
});
