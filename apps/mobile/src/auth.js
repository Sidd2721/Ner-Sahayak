import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { fdb } from './firebase.js';
import { db } from './db.js';

export function initAuth(auth, onUserChanged) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      let role = 'citizen'; // default fallback
      try {
        const userDoc = await getDoc(doc(fdb, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role) {
          role = userDoc.data().role;
        }
      } catch (err) {
        console.warn('Failed to fetch role (offline?), using fallback', err);
      }
      
      await db.session.put({ key: 'currentUser', uid: user.uid, email: user.email, role });
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

/** Returns the full cached session { uid, email, role } or null if not logged in. */
export async function getCachedUser() {
  return db.session.get('currentUser') || null;
}
