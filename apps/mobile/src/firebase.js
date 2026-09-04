import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

/**
 * Firebase client init — emulator-first per the build guide.
 * Config values come from apps/mobile/.env (Vite VITE_* vars). The values
 * committed here point at the Local Emulator Suite ONLY and contain no
 * real credentials; real keys are a deploy-day, human-only step
 * (API Keys Setup Guide v2, Part 5) and are never hardcoded.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const USE_EMULATOR = String(import.meta.env.VITE_USE_EMULATOR) === 'true';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const fdb = getFirestore(app);
export const storage = getStorage(app);

if (USE_EMULATOR) {
  const emuHost = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
  // idempotent across HMR reloads
  try { connectAuthEmulator(auth, `http://${emuHost}:9099`, { disableWarnings: true }); } catch { /* already connected */ }
  try { connectFirestoreEmulator(fdb, emuHost, 8080); } catch { /* already connected */ }
  try { connectStorageEmulator(storage, emuHost, 9199); } catch { /* already connected */ }
}
