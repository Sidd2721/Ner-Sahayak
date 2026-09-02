/**
 * Emulator test helper — initialises a firebase-admin app pointed at the
 * local emulators and returns typed handles.
 *
 * Call once per test file (or once per test if you need a clean state).
 * Use `clearEmulatorData()` between tests to avoid cross-test pollution.
 *
 * Emulator host env vars are expected to already be set (either via
 * functions/.env.emulator loaded by the test runner, or by `firebase
 * emulators:start` which sets them in the child process).
 */
import { initializeApp, getApps, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load .env.emulator into process.env (only the keys not already set). */
function loadEmulatorEnv(): void {
  const envPath = resolve(__dirname, '../../.env.emulator');
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // If running inside `firebase emulators:exec`, vars are already set.
  }
}

loadEmulatorEnv();

export type EmulatorHandles = { app: App; db: Firestore; auth: Auth };

export function initEmulatorApp(appName = 'test'): EmulatorHandles {
  // Delete existing app with same name so tests can call this multiple times.
  const existing = getApps().find((a) => a.name === appName);
  if (existing) deleteApp(existing);

  const app = initializeApp({ projectId: 'sih2026-ce822' }, appName);
  const db = getFirestore(app);
  const auth = getAuth(app);
  return { app, db, auth };
}

/**
 * Clear all data in the Firestore emulator for a clean test run.
 * Uses the emulator REST endpoint (not Admin SDK).
 */
export async function clearEmulatorData(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const projectId = 'sih2026-ce822';
  const url = `http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to clear emulator data: ${res.status} ${await res.text()}`);
  }
}

/**
 * Create a user in the Auth emulator and return their uid.
 * Used to set up test contexts without a real Auth flow.
 */
export async function createTestUser(
  auth: Auth,
  opts: { email: string; password: string; role: 'citizen' | 'driver' | 'officer' | 'control-room' },
  db: Firestore,
): Promise<string> {
  let user;
  try {
    user = await auth.createUser({ email: opts.email, password: opts.password });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      user = await auth.getUserByEmail(opts.email);
    } else {
      throw err;
    }
  }
  // Seed the /users/{uid} document so the rules' hasRole() lookup works.
  await db.doc(`users/${user.uid}`).set({
    email: opts.email,
    role: opts.role,
    createdAt: new Date().toISOString(),
  });
  return user.uid;
}
