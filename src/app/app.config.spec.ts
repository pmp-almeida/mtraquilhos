import { appConfig } from './app.config';

describe('appConfig', () => {
  it('is a well-formed ApplicationConfig with a non-empty providers array', () => {
    expect(appConfig).toBeTruthy();
    expect(Array.isArray(appConfig.providers)).toBe(true);
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });

  it('has exactly the four expected top-level providers, none undefined/null', () => {
    expect(appConfig.providers.length).toBe(4);
    for (const provider of appConfig.providers) {
      expect(provider).not.toBeUndefined();
      expect(provider).not.toBeNull();
    }
  });

  it('every provider entry is either a provider object/array or an injectable class/function', () => {
    for (const provider of appConfig.providers) {
      const isObject = typeof provider === 'object';
      const isFunction = typeof provider === 'function';
      expect(isObject || isFunction).toBe(true);
    }
  });
});
