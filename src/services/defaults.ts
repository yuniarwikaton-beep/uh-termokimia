import { ExamSettings, StudentRecord } from '../types/exam';

export const DEFAULT_EXAM_ID = 'uh-kimia-termokimia-2026';

export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  examId: DEFAULT_EXAM_ID,
  judul: 'Ulangan Harian Online — Kimia',
  mataPelajaran: 'Kimia',
  materi: 'Termokimia',
  namaGuru: 'Guru Pengampu Kimia SMA',
  token: 'KIMIA2026',
  durasiMenit: 60,
  kkm: 78,
  jumlahSoal: 30,
  acakSoal: true,
  acakOpsi: false,
  sanksiTabAktif: true,
  sanksiTingkat1: 10,
  sanksiTingkat2: 20,
  batasDiskualifikasi: 3,
  wajibFullscreen: true,
  izinkanSesiBaru: false,
  tampilkanNilaiSementara: true,
  tampilkanPembahasan: false,
  izinkanKembaliBeranda: true,
  normalisasiSkor100: true,
  waktuMulaiJadwal: '',
  waktuSelesaiJadwal: '',
  status: 'aktif',
};

export const INITIAL_STUDENTS: StudentRecord[] = [
  { nis: '2026001', nama: 'Ahmad Fauzan Pratama', kelas: 'XI IPA 1', status: 'aktif' },
  { nis: '2026002', nama: 'Aisyah Putri Rahmawati', kelas: 'XI IPA 1', status: 'aktif' },
  { nis: '2026003', nama: 'Bagas Aditya Nugroho', kelas: 'XI IPA 1', status: 'aktif' },
  { nis: '2026004', nama: 'Citra Dewi Lestari', kelas: 'XI IPA 2', status: 'aktif' },
  { nis: '2026005', nama: 'Dimas Aryo Wibowo', kelas: 'XI IPA 2', status: 'aktif' },
  { nis: '2026006', nama: 'Fathiya Nur Aziza', kelas: 'XI IPA 2', status: 'aktif' },
  { nis: '2026007', nama: 'Gilang Ramadhan Putra', kelas: 'XI IPA 3', status: 'aktif' },
  { nis: '2026008', nama: 'Hana Salsabila Putri', kelas: 'XI IPA 3', status: 'aktif' },
];

export const STORAGE_KEYS = {
  STUDENTS: 'cbt_kimia_students_v1',
  SETTINGS: 'cbt_kimia_settings_v1',
  ANSWER_KEYS: 'cbt_kimia_answer_keys_v1',
  ACTIVE_SESSION_ID: 'cbt_kimia_active_session_id_v1',
  SESSION_PREFIX: 'cbt_kimia_session_',
  RESULT_PREFIX: 'cbt_kimia_result_',
  TEACHER_AUTH: 'cbt_kimia_teacher_auth_v1',
};
