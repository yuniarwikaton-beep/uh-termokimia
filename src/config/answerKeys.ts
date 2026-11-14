import { AnswerKeyEntry } from '../types/exam';

/**
 * Konfigurasi Kunci Jawaban Terpisah (Answer Key Configuration).
 * Catatan Keamanan Produksi:
 * Pada mode produksi dengan Firebase + Cloud Functions, kunci jawaban disimpan di
 * `examSecrets/${examId}/answerKeys` yang hanya dapat dibaca oleh guru/Admin SDK.
 * Pada mode demo lokal/offline, guru dapat memeriksa, menyunting, dan memverifikasi
 * seluruh kunci di tab "Kunci Jawaban & Pembahasan" sebelum ujian diterbitkan.
 */
export const DEFAULT_ANSWER_KEYS: AnswerKeyEntry[] = [
  {
    questionId: 1,
    type: 'single',
    points: 3,
    correctIndex: 1,
    explanation:
      'Sistem adalah bagian dari alam semesta yang menjadi pusat perhatian/pengamatan, yaitu zat-zat yang bereaksi (larutan NaOH dan HCl). Gelas kimia, termometer, pengaduk, meja, dan udara sekitar merupakan lingkungan.',
    verifiedByTeacher: false,
  },
  {
    questionId: 2,
    type: 'single',
    points: 3,
    correctIndex: 2,
    explanation:
      'Termos yang ditutup rapat dirancang untuk mencegah perpindahan materi maupun energi (kalor) antara teh panas dan lingkungan, sehingga merupakan contoh sistem terisolasi.',
    verifiedByTeacher: false,
  },
  {
    questionId: 3,
    type: 'single',
    points: 3,
    correctIndex: 2,
    explanation:
      'Pembakaran metana (combustion of methane) melepaskan kalor ke lingkungan sehingga merupakan proses eksoterm. Pelelehan es, penguapan air, fotosintesis, dan dekomposisi termal CaCO₃ membutuhkan/menyerap energi (endoterm).',
    verifiedByTeacher: false,
  },
  {
    questionId: 4,
    type: 'single',
    points: 3,
    correctIndex: 1,
    explanation:
      'Pada reaksi endoterm, sistem menyerap kalor dari lingkungan sehingga entalpi sistem meningkat (ΔH > 0) dan suhu lingkungan di sekitarnya turun.',
    verifiedByTeacher: false,
  },
  {
    questionId: 5,
    type: 'single',
    points: 3,
    correctIndex: 0,
    explanation:
      'Entalpi pembentukan standar (ΔHf°) adalah perubahan entalpi pembentukan 1 mol senyawa dari unsur-unsurnya dalam keadaan standar (298 K, 1 atm): C(s) + O₂(g) → CO₂(g) ΔH = −393,5 kJ.',
    verifiedByTeacher: false,
  },
  {
    questionId: 6,
    type: 'single',
    points: 3,
    correctIndex: 1,
    explanation:
      'V total = 100 mL → m = 100 g; ΔT = 31,5 − 25,0 = 6,5 °C. q larutan = 100 × 4,18 × 6,5 = 2.717 J = 2,717 kJ. Mol H₂O terbentuk = 0,05 L × 1 M = 0,05 mol. Karena suhu naik (eksoterm), ΔH = −2,717 / 0,05 = −54,34 ≈ −54,3 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 7,
    type: 'single',
    points: 3,
    correctIndex: 0,
    explanation:
      'Target: C(s) + 2H₂(g) → CH₄(g). Gunakan Hukum Hess: pers (1) + 2 × pers (2) − pers (3) = (−394) + 2(−286) − (−890) = −394 − 572 + 890 = −76 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 8,
    type: 'single',
    points: 3,
    correctIndex: 0,
    explanation:
      'ΔH = ΣE(pemutusan reaktan) − ΣE(pembentukan produk) = [4(C–H) + 2(O=O)] − [2(C=O) + 4(O–H)] = [4(413) + 2(495)] − [2(799) + 4(463)] = (1.652 + 990) − (1.598 + 1.852) = 2.642 − 3.450 = −808 kJ.',
    verifiedByTeacher: false,
  },
  {
    questionId: 9,
    type: 'single',
    points: 3,
    correctIndex: 1,
    explanation:
      'C₃H₈(g) + 5O₂(g) → 3CO₂(g) + 4H₂O(l). ΔHc° = 3(−394) + 4(−286) − (−104) = −1.182 − 1.144 + 104 = −2.222 kJ/mol. Untuk 22 g C₃H₈ (n = 22/44 = 0,5 mol), kalor dilepaskan = 0,5 × 2.222 = 1.111 kJ.',
    verifiedByTeacher: false,
  },
  {
    questionId: 10,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 3],
    explanation:
      'Sistem adalah pusat pengamatan dan lingkungan di luar sistem. Pada sistem tertutup hanya terjadi pertukaran energi (bukan materi). Pada sistem terisolasi tidak ada pertukaran materi maupun energi. Gelas tanpa tutup adalah sistem terbuka.',
    verifiedByTeacher: false,
  },
  {
    questionId: 11,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 3],
    explanation:
      'Reaksi eksoterm melepaskan kalor dari sistem ke lingkungan, sehingga ΔH < 0 (negatif), entalpi produk lebih kecil daripada reaktan, dan suhu lingkungan meningkat.',
    verifiedByTeacher: false,
  },
  {
    questionId: 12,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 2, 4],
    explanation:
      'ΔHf° membentuk tepat 1 mol senyawa dari unsur-unsurnya pada wujud standar: H₂(g) + ½O₂(g) → H₂O(l), C(s, graphite) + 2H₂(g) → CH₄(g), dan Na(s) + ½Cl₂(g) → NaCl(s). Pilihan kedua membentuk 2 mol, dan CO adalah senyawa (bukan unsur).',
    verifiedByTeacher: false,
  },
  {
    questionId: 13,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 2],
    explanation:
      'Pembakaran 1 mol etanol (ΔHc°), penguraian 1 mol air menjadi unsurnya (ΔHd°), dan pelarutan 1 mol NaCl (ΔHs°) sudah tepat. H₂O(s) → H₂O(l) adalah peleburan (bukan penguapan), dan HCl + NaOH adalah penetralan (bukan penguraian).',
    verifiedByTeacher: false,
  },
  {
    questionId: 14,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 2],
    explanation:
      'Suhu naik (27 → 32 °C) menandakan eksoterm. q larutan = 100 × 4,2 × 5 = 2.100 J = 2,1 kJ. Mol NaOH = 2 / 40 = 0,05 mol. ΔH pelarutan = −2,1 / 0,05 = −42 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 15,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 2],
    explanation:
      'Membagi pers (2) dengan 2 menghasilkan SO₂ + ½O₂ → SO₃ (ΔH = −99 kJ). Dijumlahkan dengan pers (1): S + 3/2 O₂ → SO₃ (ΔHf° = −297 + (−99) = −396 kJ/mol). Membalik pers (2) mengubah tanda ΔH menjadi +198 kJ. Untuk 2 mol SO₃, ΔH = −792 kJ, dan menurut hukum Hess ΔH hanya bergantung pada keadaan awal dan akhir.',
    verifiedByTeacher: false,
  },
  {
    questionId: 16,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 2, 4],
    explanation:
      'Pada hidrogenasi etena, ikatan yang mengalami perubahan putus adalah 1 C=C (614) + 1 H–H (436) = 1.050 kJ, dan terbentuk 1 C–C (348) + 2 C–H (826) = 1.174 kJ. ΔH = 1.050 − 1.174 = −124 kJ (eksoterm, sehingga produk berentalpi lebih rendah dan lebih stabil).',
    verifiedByTeacher: false,
  },
  {
    questionId: 17,
    type: 'multiple',
    points: 4,
    correctIndices: [0, 1, 3],
    explanation:
      'Pelarutan NH₄NO₃ memiliki ΔH = +25,7 kJ/mol (endoterm, menyerap kalor dari lingkungan sehingga terasa dingin). Hand warmer memiliki ΔH = −1.648 kJ (eksoterm, entalpi produk lebih rendah daripada reaktan).',
    verifiedByTeacher: false,
  },
  {
    questionId: 18,
    type: 'boolean',
    points: 3,
    correctBoolean: true,
    explanation:
      'Benar. Nilai ΔH = −353 kJ (negatif) dan kenaikan suhu kantong menunjukkan reaksi melepaskan kalor dari sistem ke lingkungan (eksoterm).',
    verifiedByTeacher: false,
  },
  {
    questionId: 19,
    type: 'boolean',
    points: 3,
    correctBoolean: false,
    explanation:
      'Salah. Persamaan reaksi menunjukkan 1 mol Mg melepaskan 353 kJ. Jika 0,5 mol Mg bereaksi, kalor yang dilepaskan adalah 0,5 × 353 = 176,5 kJ (bukan 706 kJ).',
    verifiedByTeacher: false,
  },
  {
    questionId: 20,
    type: 'boolean',
    points: 3,
    correctBoolean: true,
    explanation:
      'True. Membalik reaksi mengubah tanda ΔH (+50 menjadi −50 kJ), dan mengalikan koefisien reaksi dengan 2 mengalikan ΔH dengan 2 (+100 kJ).',
    verifiedByTeacher: false,
  },
  {
    questionId: 21,
    type: 'boolean',
    points: 3,
    correctBoolean: false,
    explanation:
      'Salah. ΔH = −572 kJ adalah untuk pembentukan 2 mol H₂O(l). Entalpi pembentukan standar (per 1 mol) adalah −572 / 2 = −286 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 22,
    type: 'boolean',
    points: 3,
    correctBoolean: true,
    explanation:
      'Benar. Kalor per gram: Metana = 890/16 = 55,6 kJ/g; Etanol = 1.367/46 = 29,7 kJ/g; Hidrogen = 286/2 = 143 kJ/g. Hidrogen melepaskan kalor per gram paling besar.',
    verifiedByTeacher: false,
  },
  {
    questionId: 23,
    type: 'boolean',
    points: 3,
    correctBoolean: false,
    explanation:
      'Salah. Per mol etanol memang lebih besar (1.367 vs 890 kJ/mol), tetapi Mr etanol jauh lebih besar (46 vs 16), sehingga per gram etanol (29,7 kJ/g) lebih kecil daripada metana (55,6 kJ/g).',
    verifiedByTeacher: false,
  },
  {
    questionId: 24,
    type: 'boolean',
    points: 3,
    correctBoolean: true,
    explanation:
      'True. 8 g CH₄ (Mr = 16) = 0,5 mol. Kalor yang dilepaskan = 0,5 × 890 kJ = 445 kJ.',
    verifiedByTeacher: false,
  },
  {
    questionId: 25,
    type: 'boolean',
    points: 3,
    correctBoolean: false,
    explanation:
      'Salah. ΔH = −185 kJ adalah untuk pembentukan 2 mol HCl(g). Pembentukan 1 mol HCl melepaskan kalor 185 / 2 = 92,5 kJ.',
    verifiedByTeacher: false,
  },
  {
    questionId: 26,
    type: 'short',
    points: 4,
    acceptedAnswers: ['endothermic', 'endoterm'],
    explanation: 'A process that absorbs heat from the surroundings is called an endothermic process.',
    verifiedByTeacher: false,
  },
  {
    questionId: 27,
    type: 'short',
    points: 4,
    acceptedAnswers: ['-726', '−726', '-726,0', '-726.0', '-726 kJ/mol', '−726 kJ/mol'],
    explanation:
      'Mol CH₃OH = 3,2 / 32 = 0,1 mol. Karena melepaskan kalor 72,6 kJ (eksoterm), entalpi pembakaran molar = −72,6 / 0,1 = −726 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 28,
    type: 'short',
    points: 4,
    acceptedAnswers: ['+33', '33', '+33 kJ/mol', '33 kJ/mol', '+33,0', '33,0'],
    explanation:
      'Jumlahkan kedua persamaan: N₂(g) + 2O₂(g) → 2NO₂(g), ΔH = +180 + (−114) = +66 kJ untuk 2 mol NO₂. Maka ΔHf° NO₂(g) untuk 1 mol = +66 / 2 = +33 kJ/mol.',
    verifiedByTeacher: false,
  },
  {
    questionId: 29,
    type: 'short',
    points: 4,
    acceptedAnswers: ['76', '76%', '76 %'],
    explanation:
      'Mol C₂H₅OH = 0,92 / 46 = 0,02 mol. ΔHc° etanol = 2(−394) + 3(−286) − (−278) = −1.368 kJ/mol. Kalor pembakaran = 0,02 × 1.368 = 27,36 kJ = 27.360 J. Kalor diserap air = 250 × 4,18 × (45 − 25) = 20.900 J. Efisiensi = (20.900 / 27.360) × 100% = 76,39% ≈ 76%.',
    verifiedByTeacher: false,
  },
  {
    questionId: 30,
    type: 'short',
    points: 4,
    acceptedAnswers: ['-97', '−97', '-97 kJ', '−97 kJ', '-97,0'],
    explanation:
      'Pemutusan: 1(N≡N) + 3(H–H) = 941 + 3(436) = 2.249 kJ. Pembentukan: 6(N–H) = 6(391) = 2.346 kJ. ΔH = 2.249 − 2.346 = −97 kJ.',
    verifiedByTeacher: false,
  },
];
