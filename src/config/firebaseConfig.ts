import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';
import { FirebaseSchoolConfig } from '../types/exam';

const FIREBASE_RUNTIME_STORAGE_KEY = 'cbt_kimia_firebase_school_config_v1';

/**
 * Placeholder konfigurasi Firebase dari environment variables (.env).
 * Jangan menaruh kredensial nyata atau service account di kode sumber publik.
 * Sekolah dapat mengisi variabel VITE_FIREBASE_* di .env atau melalui
 * menu Pengaturan -> Konfigurasi Firebase pada Dashboard Guru.
 */
export const ENV_FIREBASE_PLACEHOLDER: FirebaseSchoolConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_SCHOOL_FIREBASE_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_SCHOOL_PROJECT.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://YOUR_SCHOOL_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_SCHOOL_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_SCHOOL_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_FIREBASE_APP_ID',
};

export function isPlaceholderConfig(cfg: Partial<FirebaseSchoolConfig> | null | undefined): boolean {
  if (!cfg) return true;
  const apiKey = (cfg.apiKey || '').trim();
  const dbUrl = (cfg.databaseURL || '').trim();
  const projectId = (cfg.projectId || '').trim();
  if (!apiKey || !dbUrl || !projectId) return true;
  if (
    apiKey.includes('YOUR_') ||
    dbUrl.includes('YOUR_') ||
    projectId.includes('YOUR_') ||
    !dbUrl.startsWith('https://')
  ) {
    return true;
  }
  return false;
}

export function getSavedRuntimeFirebaseConfig(): FirebaseSchoolConfig | null {
  try {
    const raw = localStorage.getItem(FIREBASE_RUNTIME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseSchoolConfig;
    return isPlaceholderConfig(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export function saveRuntimeFirebaseConfig(cfg: FirebaseSchoolConfig | null): void {
  if (!cfg) {
    localStorage.removeItem(FIREBASE_RUNTIME_STORAGE_KEY);
  } else {
    localStorage.setItem(FIREBASE_RUNTIME_STORAGE_KEY, JSON.stringify(cfg));
  }
}

export function getActiveFirebaseConfig(): FirebaseSchoolConfig {
  const runtimeCfg = getSavedRuntimeFirebaseConfig();
  if (runtimeCfg) return runtimeCfg;
  return ENV_FIREBASE_PLACEHOLDER;
}

export function isFirebaseConfigured(): boolean {
  return !isPlaceholderConfig(getActiveFirebaseConfig());
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Database | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseServices(): {
  configured: boolean;
  app: FirebaseApp | null;
  db: Database | null;
  auth: Auth | null;
  error?: string;
} {
  const cfg = getActiveFirebaseConfig();
  if (isPlaceholderConfig(cfg)) {
    return { configured: false, app: null, db: null, auth: null };
  }

  try {
    if (!cachedApp) {
      cachedApp = getApps().length > 0 ? getApp() : initializeApp(cfg);
      cachedDb = getDatabase(cachedApp);
      cachedAuth = getAuth(cachedApp);
    }
    return { configured: true, app: cachedApp, db: cachedDb, auth: cachedAuth };
  } catch (err) {
    return {
      configured: false,
      app: null,
      db: null,
      auth: null,
      error: err instanceof Error ? err.message : 'Gagal menginisialisasi Firebase SDK.',
    };
  }
}

export function resetFirebaseClientInstance(): void {
  cachedApp = null;
  cachedDb = null;
  cachedAuth = null;
}
