import { initializeApp as initClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as clientDoc, setDoc, connectFirestoreEmulator, getDoc as getClientDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Setup Admin
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-sih2026';
initAdminApp({ projectId: process.env.GCLOUD_PROJECT });
const adminDb = getAdminFirestore();

// Setup Client
const clientApp = initClientApp({
  projectId: 'demo-sih2026',
  apiKey: 'fake-api-key'
});
const clientDb = getClientFirestore(clientApp);
connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099');

async function run() {
  console.log('Authenticating client...');
  await signInWithEmailAndPassword(clientAuth, 'citizen@test.com', 'pass1234');
  const user = clientAuth.currentUser;
  console.log('Authenticated as:', user.uid);

  const reportId = crypto.randomUUID();
  console.log('Testing Phase A payload compliance with report ID:', reportId);

  // Exact payload from report-form.js (using 'unconfirmed')
  const payload = {
    reportId,
    type: 'landslide',
    severity: 4,
    description: 'Verification test payload',
    lat: 25.158,
    lng: 93.01,
    reporterId: user.uid,
    geohash: 'wh9cw', // mock geohash
    corridorId: 'nh-27',
    status: 'unconfirmed',
    createdAt: new Date().toISOString()
  };

  try {
    const ref = clientDoc(clientDb, 'reports', reportId);
    await setDoc(ref, payload);
    console.log('✅ Client successfully inserted report (firestore.rules passed).');

    // Wait for onReportCreate trigger to fire
    console.log('Waiting for backend triggers...');
    await new Promise(r => setTimeout(r, 2000));

    // Read back as Admin to bypass rules and check server-computed fields
    const docSnap = await adminDb.collection('reports').doc(reportId).get();
    const data = docSnap.data();

    console.log('--- Server State ---');
    console.log(`Corroboration Score: ${data.corroborationScore}`);
    console.log(`Priority Key: ${data.priorityKey}`);
    
    if (data.corroborationScore !== undefined && data.priorityKey !== undefined) {
      console.log('✅ Backend correctly stamped server-only fields.');
    } else {
      console.error('❌ Backend failed to stamp server-only fields.');
    }
  } catch (err) {
    console.error('❌ Client insert failed:', err.message);
  }
  
  process.exit(0);
}

run();
