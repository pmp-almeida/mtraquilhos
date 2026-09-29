import { CHANGELOG } from './changelog';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

describe('CHANGELOG', () => {
  it('is non-empty', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('is ordered newest first by date', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const previous = new Date(CHANGELOG[i - 1].date).getTime();
      const current = new Date(CHANGELOG[i].date).getTime();
      expect(previous).toBeGreaterThanOrEqual(current);
    }
  });

  it('gives every release a valid-looking semver version', () => {
    for (const release of CHANGELOG) {
      expect(release.version).toMatch(SEMVER_RE);
    }
  });

  it('has no duplicate versions', () => {
    const versions = CHANGELOG.map(release => release.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('gives every release a non-empty titleKey', () => {
    for (const release of CHANGELOG) {
      expect(typeof release.titleKey).toBe('string');
      expect(release.titleKey.length).toBeGreaterThan(0);
    }
  });

  it('gives every featureKeys entry a non-empty string', () => {
    for (const release of CHANGELOG) {
      for (const key of release.featureKeys) {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every fixKeys entry (when present) a non-empty string', () => {
    for (const release of CHANGELOG) {
      if (!release.fixKeys) continue;
      for (const key of release.fixKeys) {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }
    }
  });

  it('parses every date as a real, valid date', () => {
    for (const release of CHANGELOG) {
      expect(Number.isNaN(new Date(release.date).getTime())).toBe(false);
    }
  });

  it('has at least one release with fixKeys and at least one without, exercising both shapes', () => {
    expect(CHANGELOG.some(release => release.fixKeys && release.fixKeys.length > 0)).toBe(true);
    expect(CHANGELOG.some(release => !release.fixKeys)).toBe(true);
  });
});
