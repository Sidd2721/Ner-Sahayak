import { submitReport } from './report-form.js';
import { t } from './i18n.js';

/**
 * Report form + connectivity banner wiring. All Firestore writes happen
 * inside submitReport's Dexie transaction → outbox; nothing here touches
 * Firestore directly (guide's outbox-only rule).
 */

export function bindReportForm() {
  const form = document.getElementById('report-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const type = document.getElementById('report-type').value;
    const severity = Number(document.getElementById('report-severity').value);
    const description = document.getElementById('report-desc').value.trim();

    button.disabled = true;
    try {
      await submitReport({ type, severity, description });
      form.reset();
      document.getElementById('severity-value').textContent = '3';
      flash(document.getElementById('form-status'), 'report.savedOffline');
    } catch (err) {
      console.error('[report-form] submission failed', err);
      flash(document.getElementById('form-status'), 'common.error');
    } finally {
      button.disabled = false;
    }
  });

  const severity = document.getElementById('report-severity');
  severity.addEventListener('input', () => {
    document.getElementById('severity-value').textContent = severity.value;
  });
}

function flash(el, key) {
  el.textContent = t(key);
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

/** Online/offline indicator; fires onOnline when connectivity returns. */
export function bindConnectivity(onOnline) {
  const update = () => {
    const online = navigator.onLine;
    const el = document.getElementById('net-status');
    el.textContent = online ? `● ${t('sync.online')}` : `○ ${t('sync.offline')}`;
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
    document.getElementById('offline-banner').hidden = online;
    if (online && onOnline) onOnline();
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
