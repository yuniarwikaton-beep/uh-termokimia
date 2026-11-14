import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  AnswerKeyEntry,
  ExamResult,
  ExamSettings,
  Question,
  StudentAnswerValue,
  StudentRecord,
} from '../types/exam';

function formatDateID(ts: number): string {
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateID(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function sanitizeFilename(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_');
}

function formatStudentAnswerReadable(q: Question, ans: StudentAnswerValue): string {
  if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
    return '(Kosong)';
  }
  if (q.type === 'single' && typeof ans === 'number' && q.options) {
    const letter = String.fromCharCode(65 + ans);
    return `${letter}. ${q.options[ans] ?? ''}`;
  }
  if (q.type === 'multiple' && Array.isArray(ans) && q.options) {
    return ans
      .slice()
      .sort((a, b) => a - b)
      .map((idx) => `${String.fromCharCode(65 + idx)}. ${q.options?.[idx] ?? ''}`)
      .join('; ');
  }
  if (q.type === 'boolean' && typeof ans === 'boolean') {
    const labels = q.options || ['Benar', 'Salah'];
    return ans ? labels[0] : labels[1];
  }
  return String(ans);
}

function formatCorrectKeyReadable(q: Question, key: AnswerKeyEntry | undefined): string {
  if (!key) return '-';
  if (q.type === 'single' && typeof key.correctIndex === 'number' && q.options) {
    const letter = String.fromCharCode(65 + key.correctIndex);
    return `${letter}. ${q.options[key.correctIndex] ?? ''}`;
  }
  if (q.type === 'multiple' && Array.isArray(key.correctIndices) && q.options) {
    return key.correctIndices
      .slice()
      .sort((a, b) => a - b)
      .map((idx) => `${String.fromCharCode(65 + idx)}. ${q.options?.[idx] ?? ''}`)
      .join('; ');
  }
  if (q.type === 'boolean' && typeof key.correctBoolean === 'boolean') {
    const labels = q.options || ['Benar', 'Salah'];
    return key.correctBoolean ? labels[0] : labels[1];
  }
  if (q.type === 'short' && key.acceptedAnswers) {
    return key.acceptedAnswers[0] || '-';
  }
  return '-';
}

/**
 * Membuat dokumen jsPDF untuk satu siswa.
 */
export function buildStudentResultPDFDoc(params: {
  result: ExamResult;
  settings: ExamSettings;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
  includeExplanations?: boolean;
}): jsPDF {
  const { result, settings, questions, answerKeys, includeExplanations } = params;
  const showPembahasan = includeExplanations ?? settings.tampilkanPembahasan;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header biru bersih
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN HASIL ASESMEN SISWA', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${settings.judul} · ${settings.mataPelajaran} (${settings.materi})`, 14, 19);
  doc.text(`Guru Pengampu: ${settings.namaGuru || '-'}`, 14, 24);

  // Identitas & Ringkasan Nilai
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  autoTable(doc, {
    startY: 34,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [239, 246, 255], textColor: [30, 58, 138], fontStyle: 'bold' },
    body: [
      ['Nama Siswa', result.nama, 'Nilai Akhir', `${result.nilai} / 100`],
      ['NIS / Kelas', `${result.nis} / ${result.kelas}`, 'KKM', `${result.kkm}`],
      [
        'Tanggal Pengerjaan',
        formatDateID(result.waktuPengumpulan),
        'Status Kelulusan',
        result.statusKelulusan,
      ],
      [
        'Benar / Salah / Kosong',
        `${result.benar} / ${result.salah} / ${result.kosong}`,
        'Pelanggaran Tab',
        `${result.jumlahPelanggaran} kali (Sanksi: -${result.sanksiPoin} poin)`,
      ],
      [
        'Status Sinkronisasi',
        result.statusSinkronisasi === 'synced'
          ? 'TERSINKRONISASI (Firebase)'
          : 'TERSIMPAN LOKAL — BELUM SINKRON',
        'ID Hasil',
        result.resultId,
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, fillColor: [248, 250, 252] },
      1: { cellWidth: 62 },
      2: { fontStyle: 'bold', cellWidth: 36, fillColor: [248, 250, 252] },
      3: { cellWidth: 46 },
    },
  });

  const keyMap = new Map<number, AnswerKeyEntry>();
  for (const k of answerKeys) keyMap.set(k.questionId, k);

  const tableRows = questions.map((q) => {
    const key = keyMap.get(q.id);
    const breakdown = result.questionBreakdown?.find((b) => b.questionId === q.id);
    const ans = result.jawaban?.[q.id] ?? null;
    const ansText = formatStudentAnswerReadable(q, ans);
    const statusText = breakdown
      ? breakdown.isEmpty
        ? 'Kosong'
        : breakdown.isCorrect
          ? 'Benar'
          : 'Salah'
      : '-';

    const row: string[] = [
      String(q.id),
      q.prompt.replace(/\n+/g, ' ').slice(0, 95) + (q.prompt.length > 95 ? '...' : ''),
      ansText,
      statusText,
    ];

    if (showPembahasan) {
      row.push(`${formatCorrectKeyReadable(q, key)}\n${key?.explanation || ''}`);
    }
    return row;
  });

  const head = showPembahasan
    ? [['No', 'Ringkasan Soal', 'Jawaban Siswa', 'Status', 'Kunci & Pembahasan']]
    : [['No', 'Ringkasan Soal', 'Jawaban Siswa', 'Status']];

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 82;

  autoTable(doc, {
    startY: finalY + 6,
    head,
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    columnStyles: showPembahasan
      ? {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 42 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 62 },
        }
      : {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 78 },
          2: { cellWidth: 70 },
          3: { cellWidth: 22, halign: 'center' },
        },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw);
        if (val === 'Benar') {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Salah') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
  });

  return doc;
}

export function downloadStudentPDF(params: {
  result: ExamResult;
  settings: ExamSettings;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
  includeExplanations?: boolean;
}): void {
  const doc = buildStudentResultPDFDoc(params);
  const safeName = sanitizeFilename(params.result.nama);
  const safeNis = sanitizeFilename(params.result.nis);
  doc.save(`Hasil_Ujian_${safeName}_${safeNis}.pdf`);
}

export async function downloadAllStudentsZipPDF(params: {
  results: ExamResult[];
  settings: ExamSettings;
  questions: Question[];
  answerKeys: AnswerKeyEntry[];
}): Promise<void> {
  const { results, settings, questions, answerKeys } = params;
  const zip = new JSZip();

  for (const res of results) {
    const doc = buildStudentResultPDFDoc({
      result: res,
      settings,
      questions,
      answerKeys,
      includeExplanations: settings.tampilkanPembahasan,
    });
    const pdfBlob = doc.output('arraybuffer');
    const safeName = sanitizeFilename(res.nama);
    const safeNis = sanitizeFilename(res.nis);
    zip.file(`Hasil_Ujian_${safeName}_${safeNis}.pdf`, pdfBlob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Semua_Hasil_Ujian_${sanitizeFilename(settings.materi)}_${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadRecapPDF(params: {
  results: ExamResult[];
  settings: ExamSettings;
}): void {
  const { results, settings } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`REKAPITULASI NILAI — ${settings.judul.toUpperCase()}`, 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Mata Pelajaran: ${settings.mataPelajaran}  |  Materi: ${settings.materi}  |  KKM: ${settings.kkm}  |  Tanggal: ${formatShortDateID(Date.now())}  |  Guru: ${settings.namaGuru || '-'}`,
    14,
    19
  );

  const total = results.length;
  const lulusCount = results.filter((r) => r.statusKelulusan === 'LULUS').length;
  const remedialCount = results.filter((r) => r.statusKelulusan === 'REMIDIAL').length;
  const disqCount = results.filter((r) => r.statusKelulusan === 'DISKUALIFIKASI').length;
  const avg =
    total > 0 ? (results.reduce((acc, r) => acc + r.nilai, 0) / total).toFixed(1) : '0.0';

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(
    `Ringkasan Kelas: Total Peserta Tersinkron = ${total} siswa   ·   Lulus (≥ ${settings.kkm}) = ${lulusCount}   ·   Remedial (< ${settings.kkm}) = ${remedialCount}   ·   Diskualifikasi = ${disqCount}   ·   Rata-rata Kelas = ${avg}`,
    14,
    33
  );

  const rows = results.map((r, idx) => [
    String(idx + 1),
    r.nama,
    r.nis,
    r.kelas,
    String(r.nilai),
    String(r.benar),
    String(r.salah),
    String(r.kosong),
    String(r.jumlahPelanggaran),
    r.statusKelulusan,
    r.statusSinkronisasi === 'synced' ? 'Tersinkronisasi' : 'Menunggu Sinkron',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [
      [
        'No',
        'Nama Siswa',
        'NIS',
        'Kelas',
        'Nilai Akhir',
        'Benar',
        'Salah',
        'Kosong',
        'Pelanggaran',
        'Status Kelulusan',
        'Sinkronisasi',
      ],
    ],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'center', cellWidth: 15 },
      7: { halign: 'center', cellWidth: 15 },
      8: { halign: 'center', cellWidth: 22 },
      9: { halign: 'center', cellWidth: 32 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 9) {
        const val = String(data.cell.raw);
        if (val === 'LULUS') {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  doc.save(`Rekapitulasi_Nilai_${sanitizeFilename(settings.materi)}.pdf`);
}

export function downloadRecapExcel(params: {
  results: ExamResult[];
  settings: ExamSettings;
}): void {
  const { results, settings } = params;
  const wb = XLSX.utils.book_new();

  const total = results.length;
  const lulusCount = results.filter((r) => r.statusKelulusan === 'LULUS').length;
  const remedialCount = results.filter((r) => r.statusKelulusan === 'REMIDIAL').length;
  const disqCount = results.filter((r) => r.statusKelulusan === 'DISKUALIFIKASI').length;
  const avg = total > 0 ? Number((results.reduce((a, b) => a + b.nilai, 0) / total).toFixed(2)) : 0;

  const summaryRows = [
    ['REKAPITULASI HASIL ULANGAN HARIAN ONLINE'],
    ['Judul Ujian', settings.judul],
    ['Mata Pelajaran', settings.mataPelajaran],
    ['Materi', settings.materi],
    ['Guru Pengampu', settings.namaGuru],
    ['KKM', settings.kkm],
    ['Tanggal Ekspor', formatDateID(Date.now())],
    [],
    ['Statistik Kelas', 'Jumlah'],
    ['Total Peserta Tersinkronisasi', total],
    ['Jumlah Lulus (Nilai >= KKM)', lulusCount],
    ['Jumlah Remedial (Nilai < KKM)', remedialCount],
    ['Jumlah Diskualifikasi', disqCount],
    ['Rata-rata Nilai Kelas', avg],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Kelas');

  const detailData = results.map((r, idx) => ({
    Nomor: idx + 1,
    'Nama Siswa': r.nama,
    NIS: r.nis,
    Kelas: r.kelas,
    'Nilai Akhir': r.nilai,
    'Nilai Mentah': r.nilaiMentah,
    'Sanksi Poin': r.sanksiPoin,
    'Jawaban Benar': r.benar,
    'Jawaban Salah': r.salah,
    'Jawaban Kosong': r.kosong,
    'Jumlah Pelanggaran': r.jumlahPelanggaran,
    'Status Kelulusan': r.statusKelulusan,
    'Status Pengumpulan': 'Sudah Mengumpulkan',
    'Status Sinkronisasi':
      r.statusSinkronisasi === 'synced' ? 'Tersinkronisasi' : 'Menunggu Sinkronisasi',
    'Waktu Pengumpulan': formatDateID(r.waktuPengumpulan),
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Rekapitulasi Nilai');

  XLSX.writeFile(wb, `Rekapitulasi_Nilai_${sanitizeFilename(settings.materi)}.xlsx`);
}

export async function importStudentsFromSpreadsheet(file: File): Promise<StudentRecord[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet]);
  const parsed: StudentRecord[] = [];
  for (const row of rows) {
    const nis = String(row.NIS ?? row.nis ?? row.Nis ?? '').trim();
    const nama = String(row.Nama ?? row.nama ?? row['Nama Siswa'] ?? row.NAME ?? '').trim();
    const kelas = String(row.Kelas ?? row.kelas ?? row.Class ?? 'XI IPA').trim();
    if (nis && nama) {
      parsed.push({ nis, nama, kelas: kelas || 'XI IPA', status: 'aktif' });
    }
  }
  return parsed;
}

export function downloadStudentImportTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sample = [
    { NIS: '2026101', Nama: 'Nadia Kusuma Wardani', Kelas: 'XI IPA 1' },
    { NIS: '2026102', Nama: 'Rizky Pratama Wijaya', Kelas: 'XI IPA 1' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
  XLSX.writeFile(wb, 'Template_Import_Siswa_CBT_Kimia.xlsx');
}
