import { auth, fdb } from './firebase.js';
import { onSnapshot, doc, collection } from 'firebase/firestore';

import { initAuth, login, demoLogin, googleLogin } from './auth.js';
import { SyncEngine } from './sync.js';
import { submitReport } from './report-form.js';
import { renderStatusBoard, subscribeCorridorUpdates } from './status-board.js';
import { renderCorridorMap, startLiveLocationTracking } from './map.js';
import { initSafeRouteButton, updateSafeRouteButton } from './safe-route.js';
import { setLanguage, getLanguage, t } from './i18n.js';
import { plainLanguageRisk } from './risk.js';

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
  appTitle.textContent = t('app.name') || 'NER Sahayak';
  document.getElementById('login-title').textContent = 'Control Room Login';
  authSubmit.textContent = 'Login';
  document.getElementById('status-title').textContent = t('status.title') || 'Corridor Status (NH-27)';
  document.getElementById('report-title').textContent = t('report.title') || 'Submit Report';
  document.getElementById('severity-label').textContent = t('report.severityLabel') || 'Severity (1-5)';
  document.getElementById('report-submit').textContent = t('report.submit') || 'Submit Offline Report';
  updateSafeRouteButton(); // refresh the local-label button on language change
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
    
    window.addEventListener('nersahayak:sync', () => {
      import('./status-board.js').then(m => m.renderPendingBadge());
    });
    
    subscribeCorridorUpdates(fdb, onSnapshot, collection, doc);
    renderCorridorMap().then(() => {
      startLiveLocationTracking();
      initSafeRouteButton(); // online-only "Find Safe Route" (hidden entirely when offline)
    });
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

document.getElementById('auth-demo').addEventListener('click', async () => {
  try {
    await demoLogin(auth, fdb);
  } catch (e) {
    alert('Demo Login failed: ' + e.message);
  }
});

document.getElementById('auth-google').addEventListener('click', async () => {
  try {
    await googleLogin(auth, fdb);
  } catch (e) {
    alert('Google Login failed: ' + e.message);
  }
});

// Report Form
function updateRiskPreview() {
  const sev = parseInt(severityInput.value, 10);
  const type = document.getElementById('report-type').value;
  // Use shared logic for risk
  const risk = plainLanguageRisk({ severity: sev / 5, type, weatherImpact: 0, roadCondition: 0 }, t);
  riskPreview.textContent = risk.message + ' (' + risk.score + ')';
}

severityInput.addEventListener('input', updateRiskPreview);
document.getElementById('report-type').addEventListener('change', updateRiskPreview);

reportSubmit.addEventListener('click', async () => {
  const type = document.getElementById('report-type').value;
  const sev = parseInt(severityInput.value, 10);
  const desc = document.getElementById('report-desc').value;
  const photoInput = document.getElementById('report-photo');
  const photoFile = photoInput.files[0];
  
  if (!desc) {
    alert(t('common.error') || 'Please enter a description');
    return;
  }
  
  await submitReport({ type, severity: sev, description: desc, photoFile });
  document.getElementById('report-desc').value = '';
  if (photoInput) photoInput.value = '';
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
