export type Locale = 'en-GB' | 'pt-PT';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en-GB', 'pt-PT'];
export const DEFAULT_LOCALE: Locale = 'en-GB';
export const LOCALE_STORAGE_KEY = 'tf-locale-v1';

/** Human-readable names for the language switcher, always shown in their own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  'en-GB': 'English',
  'pt-PT': 'Português'
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
