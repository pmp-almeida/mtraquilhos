import { vi } from 'vitest';
import { AccessGateService } from './access-gate.service';
import { environment } from '../../../environments/environment';

// The build's vitest integration refuses `vi.mock()` on relative-path
// module specifiers ("The vi.mock and related methods are not supported for
// relative imports with the Angular unit-test system"), so the environment
// module can't be mocked that way here. Instead we mutate the (plain,
// non-frozen, non-readonly-at-runtime) `environment` object directly before
// constructing each service instance -- AccessGateService reads
// `environment.accessPassphraseHash` fresh every time (field initializer
// for `required`, and again inside tryUnlock()/storageKey()), so this is
// equivalent to swapping the module for these tests' purposes.

// The SHA-256 hex digest of the passphrase 'open-sesame', computed once
// with Node's crypto so the test can assert the real "correct passphrase"
// success path against jsdom's actual Web Crypto implementation (no mocking
// of crypto.subtle needed -- jsdom supports it for real).
const CORRECT_PASSPHRASE = 'open-sesame';
const CORRECT_HASH = 'd7ecdf25eaf3deba0f2628771dbdd22d4138ab6cf38f91ed02a2ca0dec7c8ab7';

describe('AccessGateService (passphrase configured -- gate required)', () => {
  const storageKey = `tf-access-unlocked:${CORRECT_HASH}`;
  const originalHash = environment.accessPassphraseHash;

  beforeEach(() => {
    (environment as any).accessPassphraseHash = CORRECT_HASH;
    localStorage.clear();
  });

  afterEach(() => {
    (environment as any).accessPassphraseHash = originalHash;
  });

  it('is required, and starts locked with nothing stored', () => {
    const service = new AccessGateService();
    expect(service.required).toBe(true);
    expect(service.unlocked()).toBe(false);
  });

  it('starts unlocked when localStorage already has this hash\'s key set to "true"', () => {
    localStorage.setItem(storageKey, 'true');
    const service = new AccessGateService();
    expect(service.unlocked()).toBe(true);
  });

  it('tryUnlock() with the wrong passphrase stays locked and does not persist anything', async () => {
    const service = new AccessGateService();
    const ok = await service.tryUnlock('definitely-wrong');
    expect(ok).toBe(false);
    expect(service.unlocked()).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('tryUnlock() with the correct passphrase unlocks and persists to localStorage under the hash-scoped key', async () => {
    const service = new AccessGateService();
    const ok = await service.tryUnlock(CORRECT_PASSPHRASE);
    expect(ok).toBe(true);
    expect(service.unlocked()).toBe(true);
    expect(localStorage.getItem(storageKey)).toBe('true');
  });

  it('tryUnlock() trims whitespace from the passphrase before hashing', async () => {
    const service = new AccessGateService();
    const ok = await service.tryUnlock(`  ${CORRECT_PASSPHRASE}  `);
    expect(ok).toBe(true);
  });

  it('lock() clears the unlocked signal and removes the stored key', async () => {
    const service = new AccessGateService();
    await service.tryUnlock(CORRECT_PASSPHRASE);
    expect(localStorage.getItem(storageKey)).toBe('true');

    service.lock();

    expect(service.unlocked()).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('storageKey is scoped to the configured hash, so a different build\'s stored unlock does not leak in', () => {
    localStorage.setItem('tf-access-unlocked:some-other-hash', 'true');
    const service = new AccessGateService();
    expect(service.unlocked()).toBe(false);
  });

  it('starts locked (rather than throwing) when localStorage.getItem throws while required', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    const service = new AccessGateService();
    expect(service.unlocked()).toBe(false);
    spy.mockRestore();
  });
});
