/**
 * Firebase Admin SDK initialisation — single shared instance for all functions.
 * Detects emulator via FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
 * automatically; no explicit emulatorHost config needed here when those env
 * vars are set before the process starts (firebase.json emulators config
 * handles this when running via `firebase emulators:start`).
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Guard against double-init when the module is imported multiple times
// (e.g., during test setup where modules are re-required per suite).
if (getApps().length === 0) {
  initializeApp();
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
