import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-sih2026';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

async function verifyReport() {
  const reportId = '3985a9ad-00ba-47eb-b626-b3e83985aa42';
  const doc = await db.collection('reports').doc(reportId).get();
  
  if (!doc.exists) {
    console.log('Report not found!');
    return;
  }
  
  const data = doc.data();
  console.log('Report Data:', JSON.stringify(data, null, 2));
  console.log('corroborationScore:', data.corroborationScore);
  console.log('priorityKey:', data.priorityKey);
}

verifyReport().catch(console.error);
