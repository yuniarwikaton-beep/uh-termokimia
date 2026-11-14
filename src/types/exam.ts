export type QuestionType = 'single' | 'multiple' | 'boolean' | 'short';

export interface QuestionTable {
  headers: string[];
  rows: string[][];
}

export interface Question {
  id: number; // Nomor asli soal 1-30
  type: QuestionType;
  akmTag?: 'AKM-Literasi' | 'AKM-Numerasi';
  contextTitle?: string;
  contextIntro?: string;
  contextBody?: string;
  table?: QuestionTable;
  prompt: string;
  options?: string[]; // Untuk single, multiple, dan label boolean ['Benar', 'Salah'] atau ['True', 'False']
  unitSuffix?: string;
  language: 'id' | 'en';
}

export interface AnswerKeyEntry {
  questionId: number;
  type: QuestionType;
  points: number;
  correctIndex?: number; // single
  correctIndices?: number[]; // multiple
  correctBoolean?: boolean; // boolean (true = opsi pertama Benar/True, false = opsi kedua Salah/False)
  acceptedAnswers?: string[]; // short
  explanation: string;
  verifiedByTeacher: boolean;
}

export interface StudentRecord {
  nis: string;
  nama: string;
  kelas: string;
  status: 'aktif' | 'nonaktif';
}

export interface ViolationRecord {
  id: string;
  timestamp: number;
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit';
  questionNumber: number;
  tier: 1 | 2 | 3;
  description: string;
}

export type StudentAnswerValue = number | number[] | boolean | string | null;

export interface ExamSettings {
  examId: string;
  judul: string;
  mataPelajaran: string;
  materi: string;
  namaGuru: string;
  token: string;
  durasiMenit: number;
  kkm: number;
  jumlahSoal: number;
  acakSoal: boolean;
  acakOpsi: boolean;
  sanksiTabAktif: boolean;
  sanksiTingkat1: number;
  sanksiTingkat2: number;
  batasDiskualifikasi: number;
  wajibFullscreen: boolean;
  izinkanSesiBaru: boolean;
  tampilkanNilaiSementara: boolean;
  tampilkanPembahasan: boolean;
  izinkanKembaliBeranda: boolean;
  normalisasiSkor100: boolean;
  waktuMulaiJadwal: string; // ISO string or empty
  waktuSelesaiJadwal: string; // ISO string or empty
  status: 'aktif' | 'draft' | 'selesai';
}

export type SessionStatus = 'belum_mulai' | 'sedang_mengerjakan' | 'submitted';

export type SyncStatusType =
  | 'online_synced'
  | 'saving_firebase'
  | 'offline_local'
  | 'pending_sync'
  | 'sync_failed';

export interface ExamSession {
  sessionId: string;
  examId: string;
  nis: string;
  nama: string;
  kelas: string;
  studentUid?: string;
  status: SessionStatus;
  urutanSoal: number[]; // Array of original question IDs (1..30)
  opsiOrder?: Record<number, number[]>; // Only if acakOpsi is enabled
  jawaban: Record<number, StudentAnswerValue>; // Keyed by original question ID
  soalRaguRagu: Record<number, boolean>; // Keyed by original question ID
  nomorAktif: number; // 1-based index in urutanSoal
  waktuMulai: number; // epoch ms
  batasWaktu: number; // epoch ms
  pelanggaranTab: ViolationRecord[];
  pelanggaranFullscreen: number;
  sanksiTingkatTertinggi: 0 | 1 | 2 | 3;
  fullscreenAktif: boolean;
  lastUpdatedAt: number;
  submittedAt?: number;
  resultId?: string;
}

export interface ExamResult {
  resultId: string;
  sessionId: string;
  examId: string;
  nis: string;
  nama: string;
  kelas: string;
  nilai: number;
  nilaiMentah: number;
  poinDiperoleh: number;
  poinMaksimal: number;
  sanksiPoin: number;
  diskualifikasi: boolean;
  kkm: number;
  statusKelulusan: 'LULUS' | 'REMIDIAL' | 'DISKUALIFIKASI';
  benar: number;
  salah: number;
  kosong: number;
  jumlahPelanggaran: number;
  pelanggaranDetail: ViolationRecord[];
  statusPengumpulan: 'submitted';
  statusSinkronisasi: 'synced' | 'pending' | 'failed';
  syncError?: string;
  waktuMulai: number;
  waktuPengumpulan: number;
  jawaban: Record<number, StudentAnswerValue>;
  questionBreakdown: Array<{
    questionId: number;
    studentAnswer: StudentAnswerValue;
    isCorrect: boolean;
    isEmpty: boolean;
    earnedPoints: number;
    maxPoints: number;
  }>;
}

export interface SyncQueueItem {
  operationId: string;
  type: 'session_update' | 'result_submit';
  sessionId: string;
  resultId?: string;
  examId: string;
  nis: string;
  timestamp: number;
  payload: unknown;
  retryCount: number;
  lastError?: string;
}

export interface FirebaseSchoolConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
