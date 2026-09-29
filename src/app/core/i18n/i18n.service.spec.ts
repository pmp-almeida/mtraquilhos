import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { I18nService } from './i18n.service';
import { LOCALE_STORAGE_KEY } from './locale';

function createService(): I18nService {
  // effect() requires an injection context to register in, and needs
  // TestBed.flushEffects() afterwards to actually run synchronously in a
  // test (there's no zone/app tick driving it here).
  const service = TestBed.runInInjectionContext(() => new I18nService());
  TestBed.flushEffects();
  return service;
}

function mockNavigatorLanguages(languages: string[]): void {
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true });
  Object.defineProperty(navigator, 'language', { value: languages[0] ?? 'en-US', configurable: true });
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectInitialLocale', () => {
    it('uses a saved valid locale over browser detection', () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-PT');
      mockNavigatorLanguages(['en-US']);
      const service = createService();
      expect(service.locale()).toBe('pt-PT');
    });

    it('ignores a saved value that is not a supported locale', () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR');
      mockNavigatorLanguages(['en-US']);
      const service = createService();
      expect(service.locale()).toBe('en-GB');
    });

    it('falls back to browser language starting with "pt"', () => {
      mockNavigatorLanguages(['pt-BR']);
      const service = createService();
      expect(service.locale()).toBe('pt-PT');
    });

    it('falls back to browser language starting with "en"', () => {
      mockNavigatorLanguages(['en-US']);
      const service = createService();
      expect(service.locale()).toBe('en-GB');
    });

    it('checks languages in order, skipping unsupported ones before a supported match', () => {
      mockNavigatorLanguages(['fr-FR', 'pt-BR']);
      const service = createService();
      expect(service.locale()).toBe('pt-PT');
    });

    it('defaults to en-GB when no browser language matches "pt" or "en"', () => {
      mockNavigatorLanguages(['fr-FR', 'de-DE']);
      const service = createService();
      expect(service.locale()).toBe('en-GB');
    });

    it('falls back to the single navigator.language when navigator.languages is empty', () => {
      mockNavigatorLanguages([]);
      Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true });
      const service = createService();
      expect(service.locale()).toBe('pt-PT');
    });
  });

  describe('setLocale', () => {
    it('updates the locale signal and persists it to localStorage', () => {
      mockNavigatorLanguages(['en-US']);
      const service = createService();
      service.setLocale('pt-PT');
      TestBed.flushEffects();
      expect(service.locale()).toBe('pt-PT');
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-PT');
    });

    it('sets document.documentElement.lang to the new locale', () => {
      mockNavigatorLanguages(['en-US']);
      const service = createService();
      service.setLocale('pt-PT');
      TestBed.flushEffects();
      expect(document.documentElement.lang).toBe('pt-PT');
    });

    it('does not throw when localStorage.setItem throws', () => {
      mockNavigatorLanguages(['en-US']);
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
      expect(() => {
        const service = createService();
        service.setLocale('pt-PT');
        TestBed.flushEffects();
      }).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('t()', () => {
    it('returns the plain translation for a key with no params', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.t('common.close')).toBe('Close');
    });

    it('interpolates every {placeholder} present in params', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.t('common.unrankedProgress', { played: 3, total: 5 })).toBe('Unranked · 3/5');
    });

    it('leaves a placeholder untouched when its param is missing', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.t('common.unrankedProgress', { played: 3 })).toBe('Unranked · 3/{total}');
    });

    it('leaves a placeholder untouched when its param is null or undefined', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.t('common.unrankedProgress', { played: null, total: undefined })).toBe('Unranked · {played}/{total}');
    });

    it('returns the same text through the other locale for the same key', () => {
      const service = createService();
      service.setLocale('pt-PT');
      expect(service.t('common.close')).toBe('Fechar');
    });

    it('falls back to the key itself when it exists in neither dictionary', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.t('totally.made.up.key' as any)).toBe('totally.made.up.key');
    });
  });

  describe('tCount()', () => {
    it('uses the ".one" suffix when count is exactly 1', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.tCount(1, 'dashboard.cardPlayers')).toBe('1 active player');
    });

    it('uses the ".other" suffix for 0 and for counts greater than 1', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.tCount(0, 'dashboard.cardPlayers')).toBe('0 active players');
      expect(service.tCount(5, 'dashboard.cardPlayers')).toBe('5 active players');
    });

    it('makes {count} available to the template automatically', () => {
      const service = createService();
      service.setLocale('en-GB');
      expect(service.tCount(3, 'playerProfile.matchesCount')).toBe('3 matches');
    });

    it('lets an explicit params object add further placeholders alongside {count}', () => {
      const service = createService();
      service.setLocale('en-GB');
      // dashboard.cardMatches has no other placeholder, but tCount must
      // still merge any extra params passed in without breaking {count}.
      expect(service.tCount(2, 'dashboard.cardMatches', {})).toBe('2 recorded matches');
    });
  });
});
