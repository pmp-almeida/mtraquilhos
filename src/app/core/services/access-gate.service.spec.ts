import { vi } from 'vitest';
import { AccessGateService } from './access-gate.service';

// This spec relies on the real environment.ts, which has an empty
// accessPassphraseHash (see src/environments/environment.ts) -- so the gate
// is inert here. The "hash actually configured" branch is covered
// separately in access-gate.service.required.spec.ts, where the
// environment module is mocked before the service is imported.
describe('AccessGateService (no passphrase configured -- inert gate)', () => {
  it('is not required', () => {
    const service = new AccessGateService();
    expect(service.required).toBe(false);
  });

  it('starts unlocked', () => {
    const service = new AccessGateService();
    expect(service.unlocked()).toBe(true);
  });

  it('tryUnlock() always resolves true and does not need the real passphrase', async () => {
    const service = new AccessGateService();
    expect(await service.tryUnlock('anything at all')).toBe(true);
    expect(await service.tryUnlock('')).toBe(true);
  });

  it('lock() still flips unlocked() back to false even though the gate is inert', () => {
    const service = new AccessGateService();
    service.lock();
    expect(service.unlocked()).toBe(false);
  });

  it('lock() does not throw when localStorage.removeItem throws', () => {
    const service = new AccessGateService();
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('unavailable'); });
    expect(() => service.lock()).not.toThrow();
    spy.mockRestore();
  });
});
