import { Question } from '../types/exam';

export const GENERAL_INSTRUCTIONS = {
  title: 'PETUNJUK UMUM',
  paragraphs: [
    'Soal terdiri atas 4 bentuk: pilihan ganda (1–9), pilihan ganda kompleks (10–17), benar-salah (18–25), dan isian singkat (26–30).',
    'Pada pilihan ganda kompleks, pilih SEMUA jawaban yang benar.',
    'Gunakan data berikut bila diperlukan: kalor jenis air/larutan = 4,18 J g⁻¹ °C⁻¹ (kecuali ditentukan lain); massa jenis larutan = 1 g mL⁻¹; Ar H = 1, C = 12, N = 14, O = 16, Na = 23, Mg = 24.',
    'Soal bertanda [AKM-Literasi] atau [AKM-Numerasi] memuat teks atau data kontekstual.',
  ],
  sectionHeaders: {
    A: 'A. PILIHAN GANDA (SOAL 1–9) — Pilihlah satu jawaban yang paling tepat.',
    B: 'B. PILIHAN GANDA KOMPLEKS (SOAL 10–17) — Pilihlah SEMUA jawaban yang benar (lebih dari satu).',
    C: 'C. BENAR-SALAH (SOAL 18–25) — Tentukan apakah pernyataan berikut BENAR atau SALAH.',
    D: 'D. ISIAN SINGKAT (SOAL 26–30) — Isilah titik-titik dengan jawaban yang singkat dan tepat.',
  },
};

export const QUESTIONS_DATA: Question[] = [
  // ==========================================
  // A. PILIHAN GANDA (SOAL 1–9)
  // ==========================================
  {
    id: 1,
    type: 'single',
    language: 'id',
    prompt:
      'Sebanyak 50 mL larutan NaOH dan 50 mL larutan HCl dicampurkan dalam sebuah gelas kimia. Pada peristiwa tersebut, yang berperan sebagai sistem adalah ...',
    options: [
      'gelas kimia',
      'larutan NaOH dan HCl yang bereaksi',
      'udara di sekitar gelas kimia',
      'meja laboratorium',
      'termometer dan pengaduk kaca',
    ],
  },
  {
    id: 2,
    type: 'single',
    language: 'id',
    prompt: 'Teh panas disimpan dalam termos yang ditutup rapat. Termos tersebut merupakan contoh sistem ...',
    options: ['terbuka', 'tertutup', 'terisolasi', 'heterogen', 'homogen'],
  },
  {
    id: 3,
    type: 'single',
    language: 'en',
    prompt: 'Which of the following processes is exothermic?',
    options: [
      'Melting of ice',
      'Evaporation of water',
      'Combustion of methane',
      'Photosynthesis',
      'Thermal decomposition of CaCO₃',
    ],
  },
  {
    id: 4,
    type: 'single',
    language: 'id',
    prompt: 'Reaksi endoterm ditandai dengan ...',
    options: [
      'ΔH < 0 dan suhu lingkungan naik',
      'ΔH > 0 dan suhu lingkungan turun',
      'ΔH > 0 dan suhu lingkungan naik',
      'ΔH < 0 dan suhu lingkungan turun',
      'ΔH = 0 dan suhu lingkungan tetap',
    ],
  },
  {
    id: 5,
    type: 'single',
    language: 'id',
    prompt: 'Persamaan termokimia yang menunjukkan perubahan entalpi pembentukan standar (ΔHf°) CO₂ adalah ...',
    options: [
      'C(s) + O₂(g) → CO₂(g) ΔH = −393,5 kJ',
      'CO(g) + ½O₂(g) → CO₂(g) ΔH = −283 kJ',
      'C(g) + O₂(g) → CO₂(g) ΔH = −1.110,5 kJ',
      '2C(s) + 2O₂(g) → 2CO₂(g) ΔH = −787 kJ',
      'H₂(g) + ½O₂(g) → H₂O(l) ΔH = −286 kJ',
    ],
  },
  {
    id: 6,
    type: 'single',
    akmTag: 'AKM-Numerasi',
    language: 'id',
    prompt:
      '[AKM-Numerasi] Dalam sebuah kalorimeter sederhana, 50 mL larutan HCl 1 M dicampur dengan 50 mL larutan NaOH 1 M. Suhu campuran naik dari 25,0 °C menjadi 31,5 °C. Jika kalor jenis larutan 4,18 J g⁻¹ °C⁻¹ dan kalorimeter dianggap tidak menyerap kalor, perubahan entalpi netralisasi per mol air yang terbentuk adalah ...',
    options: ['−27,2 kJ/mol', '−54,3 kJ/mol', '−108,7 kJ/mol', '+54,3 kJ/mol', '−2,7 kJ/mol'],
  },
  {
    id: 7,
    type: 'single',
    language: 'id',
    prompt:
      'Diketahui persamaan termokimia berikut:\n\nC(s) + O₂(g) → CO₂(g) ΔH = −394 kJ\n\nH₂(g) + ½O₂(g) → H₂O(l) ΔH = −286 kJ\n\nCH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(l) ΔH = −890 kJ\n\nEntalpi pembentukan standar CH₄(g) adalah ...',
    options: ['−76 kJ/mol', '+76 kJ/mol', '−1.856 kJ/mol', '+1.856 kJ/mol', '−1.570 kJ/mol'],
  },
  {
    id: 8,
    type: 'single',
    language: 'en',
    prompt:
      'Use the average bond energies below (kJ/mol): C–H = 413; O=O = 495; C=O = 799; O–H = 463. The enthalpy change for the reaction CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(g) is ...',
    options: ['−808 kJ', '+808 kJ', '−3.450 kJ', '+3.450 kJ', '−2.642 kJ'],
  },
  {
    id: 9,
    type: 'single',
    language: 'id',
    prompt:
      'Diketahui ΔHf° C₃H₈(g) = −104 kJ/mol, CO₂(g) = −394 kJ/mol, dan H₂O(l) = −286 kJ/mol. Kalor yang dilepaskan pada pembakaran sempurna 22 gram C₃H₈ (Mr = 44) adalah ...',
    options: ['555,5 kJ', '1.111 kJ', '2.222 kJ', '4.444 kJ', '2.326 kJ'],
  },

  // ==========================================
  // B. PILIHAN GANDA KOMPLEKS (SOAL 10–17)
  // ==========================================
  {
    id: 10,
    type: 'multiple',
    language: 'id',
    prompt: 'Pernyataan yang benar tentang sistem dan lingkungan adalah ...',
    options: [
      'Sistem adalah bagian alam semesta yang menjadi pusat pengamatan',
      'Lingkungan adalah segala sesuatu di luar sistem',
      'Pada sistem tertutup terjadi pertukaran materi dan energi',
      'Pada sistem terisolasi tidak terjadi pertukaran materi maupun energi',
      'Air dalam gelas tanpa tutup merupakan contoh sistem terisolasi',
    ],
  },
  {
    id: 11,
    type: 'multiple',
    language: 'id',
    prompt: 'Ciri-ciri reaksi eksoterm adalah ...',
    options: [
      'ΔH bernilai negatif',
      'kalor berpindah dari sistem ke lingkungan',
      'entalpi produk lebih besar daripada entalpi reaktan',
      'suhu lingkungan meningkat',
      'sistem menyerap energi dari lingkungan',
    ],
  },
  {
    id: 12,
    type: 'multiple',
    language: 'en',
    prompt: 'Which of the following equations represent the standard enthalpy of formation (ΔHf°)? Select ALL that apply.',
    options: [
      'H₂(g) + ½O₂(g) → H₂O(l)',
      '2H₂(g) + O₂(g) → 2H₂O(l)',
      'C(s, graphite) + 2H₂(g) → CH₄(g)',
      'CO(g) + ½O₂(g) → CO₂(g)',
      'Na(s) + ½Cl₂(g) → NaCl(s)',
    ],
  },
  {
    id: 13,
    type: 'multiple',
    language: 'id',
    prompt: 'Pasangan persamaan termokimia dan jenis perubahan entalpinya yang tepat adalah ...',
    options: [
      'C₂H₅OH(l) + 3O₂(g) → 2CO₂(g) + 3H₂O(l) ΔH = −1.367 kJ : entalpi pembakaran standar',
      'H₂O(l) → H₂(g) + ½O₂(g) ΔH = +286 kJ : entalpi penguraian standar',
      'NaCl(s) → Na⁺(aq) + Cl⁻(aq) ΔH = +3,9 kJ : entalpi pelarutan',
      'H₂O(s) → H₂O(l) ΔH = +6 kJ : entalpi penguapan',
      'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l) ΔH = −57 kJ : entalpi penguraian',
    ],
  },
  {
    id: 14,
    type: 'multiple',
    akmTag: 'AKM-Numerasi',
    language: 'id',
    prompt:
      '[AKM-Numerasi] Sebanyak 2 gram NaOH (Mr = 40) dilarutkan dalam 100 mL air di dalam kalorimeter sederhana. Suhu naik dari 27 °C menjadi 32 °C. Anggap massa larutan 100 g, kalor jenis larutan 4,2 J g⁻¹ °C⁻¹, dan kalorimeter tidak menyerap kalor. Pernyataan yang benar adalah ...',
    options: [
      'Pelarutan NaOH bersifat eksoterm',
      'Kalor yang diserap larutan sebesar 2.100 J',
      'ΔH pelarutan NaOH = −42 kJ/mol',
      'ΔH pelarutan NaOH = −2,1 kJ/mol',
      'Suhu larutan naik karena reaksi menyerap kalor dari lingkungan',
    ],
  },
  {
    id: 15,
    type: 'multiple',
    language: 'id',
    prompt:
      'Diketahui:\n\n(1) S(s) + O₂(g) → SO₂(g) ΔH = −297 kJ\n\n(2) 2SO₂(g) + O₂(g) → 2SO₃(g) ΔH = −198 kJ\n\nPernyataan yang benar adalah ...',
    options: [
      'ΔHf° SO₃(g) = −396 kJ/mol',
      'Jika persamaan (2) dibalik, ΔH menjadi +198 kJ',
      'Jika persamaan (2) dibagi 2, ΔH menjadi −99 kJ',
      'Pembentukan 2 mol SO₃ dari S dan O₂ memiliki ΔH = −396 kJ',
      'Menurut hukum Hess, ΔH reaksi bergantung pada jalannya reaksi',
    ],
  },
  {
    id: 16,
    type: 'multiple',
    language: 'id',
    prompt:
      'Perhatikan reaksi hidrogenasi etena: C₂H₄(g) + H₂(g) → C₂H₆(g). Energi ikatan rata-rata (kJ/mol): C=C = 614; C–C = 348; C–H = 413; H–H = 436. Pernyataan yang benar adalah ...',
    options: [
      'Ikatan yang putus adalah 1 ikatan C=C dan 1 ikatan H–H',
      'Total energi untuk memutuskan ikatan adalah 1.050 kJ',
      'ΔH reaksi = −124 kJ',
      'Reaksi tersebut bersifat endoterm',
      'Produk lebih stabil daripada reaktan',
    ],
  },
  {
    id: 17,
    type: 'multiple',
    akmTag: 'AKM-Literasi',
    language: 'en',
    contextTitle: 'Instant Cold Packs and Hand Warmers',
    contextBody:
      'Instant Cold Packs and Hand Warmers. An instant cold pack for sports injuries holds a bag of water next to solid ammonium nitrate (NH₄NO₃). When the bag is squeezed and broken, the solid dissolves:\n\nNH₄NO₃(s) → NH₄⁺(aq) + NO₃⁻(aq), ΔH = +25,7 kJ/mol.\n\nThe pack quickly becomes cold, which helps reduce swelling. In contrast, a hand warmer contains iron powder that reacts with oxygen in the air:\n\n4Fe(s) + 3O₂(g) → 2Fe₂O₃(s), ΔH = −1.648 kJ.\n\nThe warmer stays hot for hours.',
    prompt: '[AKM-Literasi] Read the text, then answer.\n\nWhich statements are correct based on the text? Select ALL that apply.',
    options: [
      'Dissolving ammonium nitrate is an endothermic process',
      'The cold pack feels cold because the system absorbs heat from its surroundings',
      'The hand warmer is an example of an endothermic reaction',
      'In the hand warmer, the products have lower enthalpy than the reactants',
      'Each mole of NH₄NO₃ dissolved releases 25,7 kJ to the surroundings',
    ],
  },

  // ==========================================
  // C. BENAR-SALAH (SOAL 18–25)
  // ==========================================
  {
    id: 18,
    type: 'boolean',
    akmTag: 'AKM-Literasi',
    language: 'id',
    contextIntro: 'Teks untuk soal 18–19.',
    contextTitle: '[AKM-Literasi] Pemanas Makanan Tanpa Api.',
    contextBody:
      'Ransum untuk pendaki dan tim darurat sering dilengkapi kantong pemanas makanan tanpa api. Kantong berisi serbuk magnesium yang ditambahkan air sehingga terjadi reaksi:\n\nMg(s) + 2H₂O(l) → Mg(OH)₂(s) + H₂(g) ΔH = −353 kJ.\n\nDalam beberapa menit, suhu kantong naik hingga 60–90 °C sehingga makanan di dekatnya ikut hangat. Gas hidrogen yang terbentuk dilepas melalui ventilasi, sehingga kantong tidak boleh dipakai di ruang tertutup rapat.',
    prompt:
      'Reaksi pada kantong pemanas makanan tergolong eksoterm karena kalor berpindah dari sistem ke lingkungan. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },
  {
    id: 19,
    type: 'boolean',
    akmTag: 'AKM-Literasi',
    language: 'id',
    contextIntro: 'Teks untuk soal 18–19.',
    contextTitle: '[AKM-Literasi] Pemanas Makanan Tanpa Api.',
    contextBody:
      'Ransum untuk pendaki dan tim darurat sering dilengkapi kantong pemanas makanan tanpa api. Kantong berisi serbuk magnesium yang ditambahkan air sehingga terjadi reaksi:\n\nMg(s) + 2H₂O(l) → Mg(OH)₂(s) + H₂(g) ΔH = −353 kJ.\n\nDalam beberapa menit, suhu kantong naik hingga 60–90 °C sehingga makanan di dekatnya ikut hangat. Gas hidrogen yang terbentuk dilepas melalui ventilasi, sehingga kantong tidak boleh dipakai di ruang tertutup rapat.',
    prompt: 'Jika 0,5 mol magnesium bereaksi sempurna, kalor yang dilepaskan sebesar 706 kJ. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },
  {
    id: 20,
    type: 'boolean',
    language: 'en',
    prompt:
      'If the reaction A → B has ΔH = +50 kJ, then the reaction B → A has ΔH = −50 kJ, and the reaction 2A → 2B has ΔH = +100 kJ. (True / False)',
    options: ['True', 'False'],
  },
  {
    id: 21,
    type: 'boolean',
    language: 'id',
    prompt:
      'Pada reaksi 2H₂(g) + O₂(g) → 2H₂O(l) dengan ΔH = −572 kJ, entalpi pembentukan standar H₂O(l) adalah −572 kJ/mol. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },
  {
    id: 22,
    type: 'boolean',
    akmTag: 'AKM-Numerasi',
    language: 'id',
    contextIntro: 'Data untuk soal 22–24.',
    contextTitle: '[AKM-Numerasi] Tabel entalpi pembakaran standar beberapa bahan bakar:',
    table: {
      headers: ['Bahan bakar', 'Rumus', 'Mr', 'ΔHc° (kJ/mol)'],
      rows: [
        ['Metana', 'CH₄', '16', '−890'],
        ['Etanol', 'C₂H₅OH', '46', '−1.367'],
        ['Hidrogen', 'H₂', '2', '−286'],
      ],
    },
    prompt:
      'Per gram bahan bakar, hidrogen melepaskan kalor paling besar di antara ketiga bahan bakar pada tabel. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },
  {
    id: 23,
    type: 'boolean',
    akmTag: 'AKM-Numerasi',
    language: 'id',
    contextIntro: 'Data untuk soal 22–24.',
    contextTitle: '[AKM-Numerasi] Tabel entalpi pembakaran standar beberapa bahan bakar:',
    table: {
      headers: ['Bahan bakar', 'Rumus', 'Mr', 'ΔHc° (kJ/mol)'],
      rows: [
        ['Metana', 'CH₄', '16', '−890'],
        ['Etanol', 'C₂H₅OH', '46', '−1.367'],
        ['Hidrogen', 'H₂', '2', '−286'],
      ],
    },
    prompt:
      'Pembakaran 1 mol etanol melepaskan kalor lebih besar daripada 1 mol metana, sehingga per gram etanol juga melepaskan kalor lebih besar daripada metana. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },
  {
    id: 24,
    type: 'boolean',
    akmTag: 'AKM-Numerasi',
    language: 'en',
    contextIntro: 'Data untuk soal 22–24.',
    contextTitle: '[AKM-Numerasi] Tabel entalpi pembakaran standar beberapa bahan bakar:',
    table: {
      headers: ['Bahan bakar', 'Rumus', 'Mr', 'ΔHc° (kJ/mol)'],
      rows: [
        ['Metana', 'CH₄', '16', '−890'],
        ['Etanol', 'C₂H₅OH', '46', '−1.367'],
        ['Hidrogen', 'H₂', '2', '−286'],
      ],
    },
    prompt: 'The complete combustion of 8 g of methane releases 445 kJ of heat. (True / False)',
    options: ['True', 'False'],
  },
  {
    id: 25,
    type: 'boolean',
    language: 'id',
    prompt:
      'Diketahui energi ikatan (kJ/mol):\n\nH–H = 436; Cl–Cl = 243; H–Cl = 432.\n\nPada reaksi H₂(g) + Cl₂(g) → 2HCl(g) diperoleh ΔH = −185 kJ, sehingga pembentukan 1 mol HCl melepaskan kalor 185 kJ. (Benar / Salah)',
    options: ['Benar', 'Salah'],
  },

  // ==========================================
  // D. ISIAN SINGKAT (SOAL 26–30)
  // ==========================================
  {
    id: 26,
    type: 'short',
    language: 'en',
    prompt: 'A process in which heat is absorbed from the surroundings is called an ................ process.',
  },
  {
    id: 27,
    type: 'short',
    language: 'id',
    prompt:
      'Pembakaran sempurna 3,2 gram metanol (CH₃OH, Mr = 32) dalam kalorimeter bom melepaskan kalor 72,6 kJ. Entalpi pembakaran molar metanol adalah ................ kJ/mol.',
    unitSuffix: 'kJ/mol',
  },
  {
    id: 28,
    type: 'short',
    language: 'id',
    prompt:
      'Diketahui:\n\nN₂(g) + O₂(g) → 2NO(g) ΔH = +180 kJ\n\n2NO(g) + O₂(g) → 2NO₂(g) ΔH = −114 kJ\n\nEntalpi pembentukan standar NO₂(g) adalah ................ kJ/mol.',
    unitSuffix: 'kJ/mol',
  },
  {
    id: 29,
    type: 'short',
    akmTag: 'AKM-Numerasi',
    language: 'id',
    prompt:
      '[AKM-Numerasi] Sebuah pembakar spiritus membakar sempurna 0,92 gram etanol (C₂H₅OH, Mr = 46). Kalor hasil pembakaran dipakai untuk memanaskan 250 gram air dari 25 °C menjadi 45 °C (kalor jenis air 4,18 J g⁻¹ °C⁻¹); sebagian kalor hilang ke lingkungan. Diketahui ΔHf° C₂H₅OH(l) = −278 kJ/mol, CO₂(g) = −394 kJ/mol, H₂O(l) = −286 kJ/mol. Efisiensi pemanasan tersebut adalah ................ % (dibulatkan ke bilangan bulat).',
    unitSuffix: '%',
  },
  {
    id: 30,
    type: 'short',
    language: 'en',
    prompt:
      'Given average bond energies (kJ/mol): N≡N = 941; H–H = 436; N–H = 391. The enthalpy change of N₂(g) + 3H₂(g) → 2NH₃(g) is ................ kJ.',
    unitSuffix: 'kJ',
  },
];
