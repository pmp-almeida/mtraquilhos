import { TranslationKey } from '../i18n/en-gb';

export interface ChangelogRelease {
  version: string;
  /** ISO date the release actually shipped, from the git history it was reconstructed from. */
  date: string;
  titleKey: TranslationKey;
  featureKeys: TranslationKey[];
  /** User-visible bug fixes worth calling out for this release, if any -- most releases have none. */
  fixKeys?: TranslationKey[];
}

/**
 * Full release history, newest first. Reconstructed from this repo's git
 * history and the spec document's dated addenda (sections 49-58) rather
 * than tracked as its own thing from day one, so versions and dates for
 * older releases are inferred groupings of same-day work rather than
 * something that was tagged in the moment -- accurate, but not something
 * this file can regenerate on its own the way rank.constants.ts can.
 *
 * Going forward: bump `package.json`'s `version` and add a new entry here
 * (newest first) whenever a release ships. Every string is a translation
 * key (see en-gb.ts / pt-pt.ts's "---- Changelog ----" section) rather
 * than inline text, so the changelog page reads through I18nService like
 * every other screen in the app.
 */
export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '1.3.1',
    date: '2026-09-24',
    titleKey: 'changelog.v1_3_1.title',
    featureKeys: ['changelog.v1_3_1.f1']
  },
  {
    version: '1.3.0',
    date: '2026-09-24',
    titleKey: 'changelog.v1_3_0.title',
    featureKeys: ['changelog.v1_3_0.f1']
  },
  {
    version: '1.2.0',
    date: '2026-09-24',
    titleKey: 'changelog.v1_2_0.title',
    featureKeys: ['changelog.v1_2_0.f1']
  },
  {
    version: '1.1.0',
    date: '2026-09-24',
    titleKey: 'changelog.v1_1_0.title',
    featureKeys: ['changelog.v1_1_0.f1', 'changelog.v1_1_0.f2']
  },
  {
    version: '1.0.0',
    date: '2026-09-23',
    titleKey: 'changelog.v1_0_0.title',
    featureKeys: ['changelog.v1_0_0.f1', 'changelog.v1_0_0.f2', 'changelog.v1_0_0.f3', 'changelog.v1_0_0.f4', 'changelog.v1_0_0.f5']
  },
  {
    version: '0.8.0',
    date: '2026-09-23',
    titleKey: 'changelog.v0_8_0.title',
    featureKeys: ['changelog.v0_8_0.f1', 'changelog.v0_8_0.f2']
  },
  {
    version: '0.7.0',
    date: '2026-09-23',
    titleKey: 'changelog.v0_7_0.title',
    featureKeys: ['changelog.v0_7_0.f1']
  },
  {
    version: '0.6.0',
    date: '2026-09-23',
    titleKey: 'changelog.v0_6_0.title',
    featureKeys: ['changelog.v0_6_0.f1']
  },
  {
    version: '0.5.0',
    date: '2026-09-22',
    titleKey: 'changelog.v0_5_0.title',
    featureKeys: ['changelog.v0_5_0.f1', 'changelog.v0_5_0.f2', 'changelog.v0_5_0.f3'],
    fixKeys: ['changelog.v0_5_0.fix1']
  },
  {
    version: '0.4.0',
    date: '2026-09-22',
    titleKey: 'changelog.v0_4_0.title',
    featureKeys: ['changelog.v0_4_0.f1']
  },
  {
    version: '0.3.0',
    date: '2026-09-22',
    titleKey: 'changelog.v0_3_0.title',
    featureKeys: ['changelog.v0_3_0.f1', 'changelog.v0_3_0.f2']
  },
  {
    version: '0.2.0',
    date: '2026-09-22',
    titleKey: 'changelog.v0_2_0.title',
    featureKeys: ['changelog.v0_2_0.f1', 'changelog.v0_2_0.f2', 'changelog.v0_2_0.f3'],
    fixKeys: ['changelog.v0_2_0.fix1']
  },
  {
    version: '0.1.0',
    date: '2026-09-16',
    titleKey: 'changelog.v0_1_0.title',
    featureKeys: ['changelog.v0_1_0.f1', 'changelog.v0_1_0.f2', 'changelog.v0_1_0.f3', 'changelog.v0_1_0.f4', 'changelog.v0_1_0.f5', 'changelog.v0_1_0.f6', 'changelog.v0_1_0.f7', 'changelog.v0_1_0.f8']
  }

];
