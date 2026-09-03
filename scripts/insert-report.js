import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Connect to the local emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'demo-sih2026';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

async function insertReport() {
  const reportId = crypto.randomUUID();
  
  // Real citizen submission payload: no corroborationScore, no priorityKey
  const payload = {
    id: reportId,
    type: 'landslide',
    severity: 5,
    description: 'Massive landslide blocking NH-27 near Haflong',
    geohash: 'wh9cw', // Haflong area approx
    corridorId: 'nh-27',
    lat: 25.178,
    lng: 93.018,
    reporterId: 'citizen-123',
    status: 'unconfirmed',
    createdAt: new Date().toISOString(),
    clientCreatedAt: new Date().toISOString(),
    serverReceivedAt: new Date()
  };

  console.log('Inserting test report without server-computed fields:', reportId);
  await db.collection('reports').doc(reportId).set(payload);
  console.log('Inserted successfully!');
}

insertReport().catch(console.error);
