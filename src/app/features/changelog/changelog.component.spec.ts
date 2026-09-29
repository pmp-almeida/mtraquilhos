import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangelogComponent } from './changelog.component';
import { CHANGELOG } from '../../core/changelog/changelog';
import { I18nService } from '../../core/i18n/i18n.service';

describe('ChangelogComponent', () => {
  let fixture: ComponentFixture<ChangelogComponent>;
  let component: ChangelogComponent;
  let i18n: I18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangelogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ChangelogComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
  });

  it('creates and renders the real CHANGELOG data (pure rendering, no transformation)', () => {
    expect(component).toBeTruthy();
    expect((component as unknown as { releases: unknown }).releases).toBe(CHANGELOG);
  });

  describe('rendering', () => {
    it('renders one release card per CHANGELOG entry, each with its translated title and version', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const cards = el.querySelectorAll('.release-card');
      expect(cards).toHaveLength(CHANGELOG.length);

      for (const [i, release] of CHANGELOG.entries()) {
        const card = cards[i];
        expect(card.querySelector('.version')?.textContent).toContain(release.version);
        expect(card.querySelector('.release-title')?.textContent).toBe(i18n.t(release.titleKey));
      }
    });

    it('marks only the very first (newest) release with the "current" badge and dot', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const cards = el.querySelectorAll('.release-card');
      expect(cards[0].querySelector('.current-chip')).toBeTruthy();
      for (let i = 1; i < cards.length; i++) {
        expect(cards[i].querySelector('.current-chip')).toBeFalsy();
      }
      expect(el.querySelectorAll('.dot.current')).toHaveLength(1);
    });

    it('shows a Features section with one entry per featureKey for a release that has features', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const withFeatures = CHANGELOG.findIndex(r => r.featureKeys.length > 0);
      expect(withFeatures).toBeGreaterThanOrEqual(0);
      const card = el.querySelectorAll('.release-card')[withFeatures];
      const featureList = card.querySelector('.feature-list:not(.fixes)');
      expect(featureList).toBeTruthy();
      expect(featureList!.querySelectorAll('li')).toHaveLength(CHANGELOG[withFeatures].featureKeys.length);
      expect(card.querySelector('.group-label:not(.fixes)')?.textContent).toBe(i18n.t('changelog.featuresLabel'));
    });

    it('shows a Fixes section with one entry per fixKey for a release that has fixes', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const withFixes = CHANGELOG.findIndex(r => (r.fixKeys ?? []).length > 0);
      expect(withFixes).toBeGreaterThanOrEqual(0);
      const card = el.querySelectorAll('.release-card')[withFixes];
      const fixList = card.querySelector('.feature-list.fixes');
      expect(fixList).toBeTruthy();
      expect(fixList!.querySelectorAll('li')).toHaveLength(CHANGELOG[withFixes].fixKeys!.length);
      expect(card.querySelector('.group-label.fixes')?.textContent).toBe(i18n.t('changelog.fixesLabel'));
    });

    it('regression: a fix-only release (empty featureKeys) renders NO empty/orphaned Features heading or list', async () => {
      // v1.4.1 in CHANGELOG is exactly this shape: featureKeys: [], fixKeys: ['...fix1'].
      const fixOnlyIndex = CHANGELOG.findIndex(r => r.featureKeys.length === 0 && (r.fixKeys ?? []).length > 0);
      expect(fixOnlyIndex).toBeGreaterThanOrEqual(0);

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const card = el.querySelectorAll('.release-card')[fixOnlyIndex];

      // No Features group label/list at all -- not just an empty one.
      expect(card.querySelector('.group-label:not(.fixes)')).toBeFalsy();
      expect(card.querySelector('.feature-list:not(.fixes)')).toBeFalsy();
      // But its Fixes section is present and populated.
      expect(card.querySelector('.group-label.fixes')).toBeTruthy();
      expect(card.querySelector('.feature-list.fixes')?.querySelectorAll('li').length).toBe(CHANGELOG[fixOnlyIndex].fixKeys!.length);
    });

    it('renders no Fixes section at all for a release with no fixKeys', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const noFixesIndex = CHANGELOG.findIndex(r => !r.fixKeys || r.fixKeys.length === 0);
      expect(noFixesIndex).toBeGreaterThanOrEqual(0);
      const card = el.querySelectorAll('.release-card')[noFixesIndex];
      expect(card.querySelector('.group-label.fixes')).toBeFalsy();
      expect(card.querySelector('.feature-list.fixes')).toBeFalsy();
    });

    it('renders the heading section with the eyebrow, title, and subtitle translation keys', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.tf-eyebrow')?.textContent).toBe(i18n.t('changelog.eyebrow'));
      expect(el.querySelector('h1')?.textContent).toBe(i18n.t('changelog.title'));
    });
  });
});
