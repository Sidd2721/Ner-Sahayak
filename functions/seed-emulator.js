import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'demo-sih2026';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const auth = getAuth();
const db = getFirestore();

async function seed() {
  try {
    await auth.createUser({
      uid: 'citizen-123',
      email: 'citizen@test.com',
      password: 'pass1234',
    });
    console.log('✅ Created citizen@test.com');
  } catch (e) {
    console.log('Citizen exists or error:', e.message);
  }

  try {
    await auth.createUser({
      uid: 'officer-123',
      email: 'control-room@test.com',
      password: 'pass1234',
    });
    console.log('✅ Created control-room@test.com');
  } catch (e) {
    console.log('Officer exists or error:', e.message);
  }

  await db.collection('districts').doc('cachar-silchar').set({
    name: 'Cachar (Silchar)',
    connectivityStatus: 'connected',
    continuityGap: 4,
    currentRiskScore: 0.15,
    stockBufferDays: 10,
    lastUpdated: new Date().toISOString()
  });
  await db.collection('corridors').doc('nh-27').set({
    status: 'open'
  });
  console.log('✅ Seeded DB');
}

seed();
