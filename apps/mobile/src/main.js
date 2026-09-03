import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, onSnapshot, doc } from 'firebase/firestore';

import { initAuth, login } from './auth.js';
import { SyncEngine } from './sync.js';
import { submitReport } from './report-form.js';
import { renderStatusBoard, subscribeCorridorUpdates } from './status-board.js';
import { setLanguage, getLanguage, t } from './i18n.js';
import { plainLanguageRisk } from './risk.js';

// Dummy config for emulator
const firebaseConfig = {
  projectId: "sih2026-ce822",
  apiKey: "dummy-api-key",
  appId: "dummy-app-id"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fdb = getFirestore(app);

// Use emulator-only config
if (import.meta.env.VITE_USE_EMULATOR === 'true' || true) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(fdb, '127.0.0.1', 8080);
}

// UI Elements
const appTitle = document.getElementById('app-title');
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const langSelect = document.getElementById('lang-select');
const authSubmit = document.getElementById('auth-submit');
const reportSubmit = document.getElementById('report-submit');
const severityInput = document.getElementById('report-severity');
const riskPreview = document.getElementById('risk-preview');

// i18n initialization
langSelect.value = getLanguage();
langSelect.addEventListener('change', (e) => {
  setLanguage(e.target.value);
  updateTranslations();
});

function updateTranslations() {
  appTitle.textContent = t('app.title') || 'NER Sahayak';
  document.getElementById('login-title').textContent = t('login.title') || 'Login';
  authSubmit.textContent = t('login.submit') || 'Login';
  document.getElementById('status-title').textContent = t('status.title') || 'Corridor Status (NH-27)';
  document.getElementById('report-title').textContent = t('report.title') || 'Submit Report';
  document.getElementById('severity-label').textContent = t('report.severity') || 'Severity (1-5)';
  reportSubmit.textContent = t('report.submit') || 'Submit Offline Report';
  updateRiskPreview();
}

// Auth flow
initAuth(auth, (user) => {
  if (user) {
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
    
    // Start syncing and listeners only when authenticated
    const syncEngine = new SyncEngine(fdb);
    syncEngine.start();
    
    subscribeCorridorUpdates(fdb, onSnapshot, null, doc);
  } else {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
  }
});

authSubmit.addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-pass').value;
  if (email && pass) {
    try {
      await login(auth, email, pass);
    } catch (e) {
      alert('Login failed: ' + e.message);
    }
  }
});

// Report Form
function updateRiskPreview() {
  const sev = parseInt(severityInput.value, 10);
  const type = document.getElementById('report-type').value;
  // Use shared logic for risk
  const risk = plainLanguageRisk({ severity: sev / 10, type, weatherImpact: 0, roadCondition: 0 }, t);
  riskPreview.textContent = risk.message + ' (' + risk.score + ')';
}

severityInput.addEventListener('input', updateRiskPreview);
document.getElementById('report-type').addEventListener('change', updateRiskPreview);

reportSubmit.addEventListener('click', async () => {
  const type = document.getElementById('report-type').value;
  const sev = parseInt(severityInput.value, 10);
  const desc = document.getElementById('report-desc').value;
  
  if (!desc) {
    alert(t('error.descRequired') || 'Please enter a description');
    return;
  }
  
  await submitReport({ type, severity: sev, description: desc });
  document.getElementById('report-desc').value = '';
});

// Initial renders
updateTranslations();
renderStatusBoard(); // Render whatever is in local cache immediately

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}
