import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getDoc, doc, setDoc } from 'firebase/firestore';
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

export async function demoLogin(auth, fdb) {
  const email = 'demo@nersahayak.com';
  const pass = 'demo123';
  try {
    return await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    // If user doesn't exist, create it and self-assign citizen role
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(fdb, 'users', credential.user.uid), { role: 'citizen' });
    return credential;
  }
}

export async function googleLogin(auth, fdb) {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const userDoc = await getDoc(doc(fdb, 'users', credential.user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(fdb, 'users', credential.user.uid), { role: 'citizen', email: credential.user.email });
  }
  return credential;
}

export async function getCachedRole() {
  const session = await db.session.get('currentUser');
  return session?.role || null;
}

/** Returns the full cached session { uid, email, role } or null if not logged in. */
export async function getCachedUser() {
  return db.session.get('currentUser') || null;
}
