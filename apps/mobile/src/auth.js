import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from './db.js';

export function initAuth(auth, onUserChanged) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Typically we'd fetch the role from Firestore, but since this is offline-first,
      // we might just cache whatever we can, or assume reporter.
      // For this spec, we just cache uid and email.
      await db.session.put({ key: 'currentUser', uid: user.uid, email: user.email, role: 'reporter' });
      onUserChanged(user);
    } else {
      await db.session.delete('currentUser');
      onUserChanged(null);
    }
  });
}

export async function login(auth, email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function getCachedRole() {
  const session = await db.session.get('currentUser');
  return session?.role || null;
}
