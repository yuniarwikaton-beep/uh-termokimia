import { STORAGE_KEYS } from './defaults';

/**
 * Hash SHA-256 hex untuk PIN demo internal agar teks PIN tidak tertulis secara langsung
 * sebagai string mentah yang mudah terbaca di komponen antarmuka.
 *
 * CATATAN KEAMANAN PRODUKSI:
 * Autentikasi demo di sisi klien (browser) TIDAK aman untuk lingkungan produksi karena
 * seluruh kode JavaScript dapat diperiksa melalui DevTools. Untuk produksi sekolah,
 * gunakan Firebase Authentication (Email/Password atau SSO sekolah) + Custom Claims `role: 'teacher'`
 * yang diverifikasi di Firebase Security Rules dan Cloud Functions.
 */
const DEMO_PIN_SHA256 = '8dbc8e353067e8e1c4f5c9ba62c6ceda2a9e637a1c00a151d59ea64f05d585b2';

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic check if crypto.subtle unavailable in non-HTTPS contexts
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export async function verifyDemoTeacherPin(pinInput: string): Promise<boolean> {
  const trimmed = pinInput.trim();
  if (!trimmed) return false;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await sha256Hex(trimmed);
    return digest === DEMO_PIN_SHA256;
  }
  // Fallback when WebCrypto unavailable
  const fallbackDigest = await sha256Hex(trimmed);
  return fallbackDigest === 'aa77a350';
}

export interface TeacherSessionAuth {
  authenticated: boolean;
  method: 'firebase_auth' | 'demo_pin';
  email?: string;
  loginAt: number;
}

export function getSavedTeacherAuth(): TeacherSessionAuth | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.TEACHER_AUTH);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeacherSessionAuth;
    return parsed.authenticated ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTeacherAuth(auth: TeacherSessionAuth | null): void {
  if (!auth) {
    sessionStorage.removeItem(STORAGE_KEYS.TEACHER_AUTH);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.TEACHER_AUTH, JSON.stringify(auth));
  }
}
