import { effect, Injectable, signal } from '@angular/core';
import { DEFAULT_LOCALE, isSupportedLocale, Locale, LOCALE_STORAGE_KEY } from './locale';
import { EN_GB, TranslationKey } from './en-gb';
import { PT_PT } from './pt-pt';

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  'en-GB': EN_GB,
  'pt-PT': PT_PT
};

/**
 * Runtime translation service. The whole app reads through `t()`/`tCount()`
 * called directly from templates (the same convention this codebase already
 * uses for other per-render lookups, e.g. `nameOf()` in several components)
 * rather than a pipe -- a signal read executed synchronously while a
 * template is being rendered is tracked as a dependency of that template's
 * reactive consumer regardless of how many function calls it passes through,
 * so every template that calls `i18n.t(...)` re-renders instantly the
 * moment `locale` changes, with no reload and no zone-based workaround
 * needed.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(this.detectInitialLocale());

  constructor() {
    // Keep <html lang> correct for assistive tech/SEO, and persist the
    // choice, every time the locale signal changes (including the very
    // first run, so a browser-detected locale is also saved).
    effect(() => {
      const locale = this.locale();
      if (typeof document !== 'undefined') document.documentElement.lang = locale;
      try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* storage unavailable, non-fatal */ }
    });
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
  }

  /** Translate a key, interpolating any `{name}` placeholders from `params`. */
  t(key: TranslationKey, params?: Record<string, string | number | null | undefined>): string {
    const template = DICTIONARIES[this.locale()][key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      params[name] !== undefined && params[name] !== null ? String(params[name]) : match
    );
  }

  /**
   * Count-aware translation: looks up `${keyBase}.one` when count is exactly
   * 1, `${keyBase}.other` otherwise (the same simple two-form rule applies
   * to both English and European Portuguese for every plural used in this
   * app). `count` is automatically available to the template as `{count}`.
   */
  tCount(count: number, keyBase: string, params?: Record<string, string | number | null | undefined>): string {
    const suffix = count === 1 ? 'one' : 'other';
    return this.t(`${keyBase}.${suffix}` as TranslationKey, { count, ...params });
  }

  private detectInitialLocale(): Locale {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved && isSupportedLocale(saved)) return saved;
    } catch { /* storage unavailable, fall through to browser detection */ }

    const browserLocales = typeof navigator !== 'undefined'
      ? (navigator.languages?.length ? navigator.languages : [navigator.language])
      : [];
    for (const candidate of browserLocales) {
      if (candidate?.toLowerCase().startsWith('pt')) return 'pt-PT';
      if (candidate?.toLowerCase().startsWith('en')) return 'en-GB';
    }
    return DEFAULT_LOCALE;
  }
}
