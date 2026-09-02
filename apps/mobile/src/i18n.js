import en from '@shared/i18n/en.json';
import hi from '@shared/i18n/hi.json';
import as from '@shared/i18n/as.json';

const dictionaries = { en, hi, as };

export function getLanguage() {
  return localStorage.getItem('ner_lang') || 'en';
}

export function setLanguage(lang) {
  if (dictionaries[lang]) {
    localStorage.setItem('ner_lang', lang);
  }
}

export function t(key) {
  const lang = getLanguage();
  const dict = dictionaries[lang] || dictionaries.en;
  
  // Support nested keys like "risk.low"
  const keys = key.split('.');
  let val = dict;
  for (let k of keys) {
    if (val && typeof val === 'object') {
      val = val[k];
    } else {
      return key; // fallback to key itself
    }
  }
  return val || key;
}
