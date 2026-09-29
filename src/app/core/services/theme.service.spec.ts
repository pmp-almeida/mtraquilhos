import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeService } from './theme.service';

const THEME_STORAGE_KEY = 'tf-theme-v1';

function createService(): ThemeService {
  // effect() requires an injection context to register in, and needs
  // TestBed.flushEffects() afterwards to actually run synchronously in a
  // test (there's no zone/app tick driving it here).
  const service = TestBed.runInInjectionContext(() => new ThemeService());
  TestBed.flushEffects();
  return service;
}

// jsdom does not implement window.matchMedia at all (it's `undefined`, not
// a stubbable function), so it must be defined outright rather than spied
// on -- and removed afterwards so it doesn't leak into other spec files.
function mockMatchMedia(matchesForQuery: boolean | ((query: string) => boolean)): void {
  const impl = typeof matchesForQuery === 'function' ? matchesForQuery : () => matchesForQuery;
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({ matches: impl(query) }),
    writable: true,
    configurable: true
  });
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).matchMedia;
  });

  describe('detectInitialTheme', () => {
    it('uses the saved localStorage value when present, over any system preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      mockMatchMedia(false);
      const service = createService();
      expect(service.theme()).toBe('light');
    });

    it('falls back to light when the OS reports a light preference and nothing is saved', () => {
      mockMatchMedia(query => query === '(prefers-color-scheme: light)');
      const service = createService();
      expect(service.theme()).toBe('light');
    });

    it('defaults to dark when nothing is saved and the OS does not prefer light', () => {
      mockMatchMedia(false);
      const service = createService();
      expect(service.theme()).toBe('dark');
    });

    it('ignores a garbage saved value and falls through to system/default detection', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'neon');
      mockMatchMedia(false);
      const service = createService();
      expect(service.theme()).toBe('dark');
    });
  });

  describe('setTheme / toggle', () => {
    it('setTheme() updates the signal', () => {
      mockMatchMedia(false);
      const service = createService();
      service.setTheme('light');
      expect(service.theme()).toBe('light');
    });

    it('toggle() flips dark <-> light', () => {
      mockMatchMedia(false);
      const service = createService();
      expect(service.theme()).toBe('dark');
      service.toggle();
      expect(service.theme()).toBe('light');
      service.toggle();
      expect(service.theme()).toBe('dark');
    });
  });

  describe('constructor effect', () => {
    it('sets document.documentElement[data-theme]="light" when the theme is light', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      const service = createService();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      void service;
    });

    it('removes the data-theme attribute when the theme is dark', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      createService();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('re-runs and updates the DOM attribute when the theme changes after construction', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      const service = createService();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

      service.setTheme('light');
      TestBed.flushEffects();

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('persists every theme change to localStorage under the theme storage key', () => {
      const service = createService();
      service.setTheme('light');
      TestBed.flushEffects();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

      service.setTheme('dark');
      TestBed.flushEffects();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('does not throw when localStorage.setItem throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
      expect(() => {
        createService();
        TestBed.flushEffects();
      }).not.toThrow();
      spy.mockRestore();
    });
  });
});
