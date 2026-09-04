import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
  projectId: 'sih2026-4d419',
});

async function seed() {
  const db = admin.firestore();
  const auth = admin.auth();

  console.log('Seeding demo user...');
  try {
    const demo = await auth.createUser({
      email: 'demo@nersahayak.com',
      password: 'demo123',
    });
    await db.collection('users').doc(demo.uid).set({
      email: 'demo@nersahayak.com',
      role: 'citizen',
    });
    console.log('Demo user created:', demo.uid);
  } catch (e) {
    console.log('Demo user error:', e.message);
  }

  console.log('Seeding control-room user...');
  try {
    const cr = await auth.createUser({
      email: 'control-room@nersahayak.com',
      password: 'd0da73fbe05b',
    });
    await db.collection('users').doc(cr.uid).set({
      email: 'control-room@nersahayak.com',
      role: 'control-room',
    });
    console.log('Control room user created:', cr.uid);
  } catch (e) {
    console.log('Control room user error:', e.message);
  }

  console.log('Seeding districts...');
  try {
    const districts = [
      {
        id: 'dima-hasao',
        name: 'Dima Hasao (Haflong)',
        connectivityStatus: 'connected',
        currentRiskScore: 0.3,
        stockBufferDays: 14,
        lastUpdated: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'cachar',
        name: 'Cachar (Silchar)',
        connectivityStatus: 'connected',
        currentRiskScore: 0.3,
        stockBufferDays: 10,
        lastUpdated: '2026-09-02T00:00:00.000Z',
      },
    ];

    for (const d of districts) {
      await db.collection('districts').doc(d.id).set(d);
      console.log('Seeded district:', d.name);
    }
  } catch (e) {
    console.log('District seed error:', e.message);
  }

  console.log('Done!');
}

seed().catch(console.error);
