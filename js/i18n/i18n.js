import { SUPPORTED_LANGS, TRANSLATIONS } from './translations.js?v=2';

const LANG_COOKIE_NAME = 'wmc_lang';

function getCookie(name) {
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function setCookie(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function detectBrowserLang() {
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || 'en'];
  for (const raw of candidates) {
    const code = String(raw).toLowerCase().split('-')[0];
    if (SUPPORTED_LANGS.includes(code)) {
      return code;
    }
  }
  return 'en';
}

class I18nService {
  constructor() {
    const cookieLang = getCookie(LANG_COOKIE_NAME);
    this.lang = SUPPORTED_LANGS.includes(cookieLang) ? cookieLang : detectBrowserLang();
    this.listeners = new Set();
  }

  getLang() {
    return this.lang;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setLang(lang, { persist = true } = {}) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    this.lang = lang;
    if (persist) {
      setCookie(LANG_COOKIE_NAME, lang);
    }
    this.applyToDOM();
    for (const fn of this.listeners) {
      fn(lang);
    }
  }

  hasKey(key) {
    const dict = TRANSLATIONS[this.lang] || TRANSLATIONS.en;
    return Object.prototype.hasOwnProperty.call(dict, key) ||
      Object.prototype.hasOwnProperty.call(TRANSLATIONS.en, key);
  }

  t(key, params = {}) {
    const dict = TRANSLATIONS[this.lang] || TRANSLATIONS.en;
    let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
    return text;
  }

  applyToDOM() {
    document.documentElement.lang = this.lang;

    const titleKey = document.body?.dataset?.titleKey || 'meta.title';
    if (this.hasKey(titleKey)) {
      document.title = this.t(titleKey);
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (this.hasKey(key)) {
        el.textContent = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (this.hasKey(key)) {
        el.innerHTML = this.t(key);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (this.hasKey(key)) {
        el.placeholder = this.t(key);
      }
    });

    const selector = document.getElementById('lang-selector');
    if (selector && selector.value !== this.lang) {
      selector.value = this.lang;
    }
  }
}

export const i18n = new I18nService();
export const t = (key, params) => i18n.t(key, params);
