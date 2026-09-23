import { effect, Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'tf-theme-v1';
const DEFAULT_THEME: Theme = 'dark';

/**
 * Runtime light/dark theme switcher, mirroring I18nService's pattern: a
 * single signal the whole app can read, persisted to localStorage, applied
 * without a rebuild or reload. Unlike locale switching, Angular Material's
 * `mat.theme()` mixin bakes CSS custom properties in at build time, so this
 * doesn't regenerate the theme -- instead styles.scss includes the mixin
 * twice, once for the default (dark) palette scoped to `html` and once for
 * the light palette scoped to `html[data-theme='light']`. Setting the
 * `data-theme` attribute here is what switches between the two pre-built
 * sets of variables.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.detectInitialTheme());

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (typeof document !== 'undefined') {
        if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
      }
      try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* storage unavailable, non-fatal */ }
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  toggle(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private detectInitialTheme(): Theme {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage unavailable, fall through to system preference */ }

    // The app's original design (spec section 35) is a dark, competitive
    // theme by default; only respect a browser preference of *light* as an
    // override for a first-time visitor, rather than defaulting to
    // whatever the OS reports either way.
    try {
      if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch { /* matchMedia unavailable, non-fatal */ }

    return DEFAULT_THEME;
  }
}
