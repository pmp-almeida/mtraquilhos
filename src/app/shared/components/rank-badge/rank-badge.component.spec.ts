import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RankBadgeComponent } from './rank-badge.component';
import { RankState } from '../../../core/models/rank-state';
import { RANK_COLORS } from '../../../rank/rank.constants';

describe('RankBadgeComponent', () => {
  let fixture: ComponentFixture<RankBadgeComponent>;

  async function setup(): Promise<ComponentFixture<RankBadgeComponent>> {
    await TestBed.configureTestingModule({ imports: [RankBadgeComponent] }).compileComponents();
    return TestBed.createComponent(RankBadgeComponent);
  }

  beforeEach(async () => {
    fixture = await setup();
  });

  const unranked: RankState = { tier: 'Unranked', division: null, rr: null };
  const ironI: RankState = { tier: 'Iron', division: 'I', rr: 42 };
  const champion: RankState = { tier: 'Champion', division: null, rr: null };

  it('shows placement progress for Unranked when placementMatches is provided', () => {
    fixture.componentRef.setInput('rank', unranked);
    fixture.componentRef.setInput('placementMatches', 3);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Unranked · 3/10');
  });

  it('falls back to the generic Unranked label when placementMatches is not provided', () => {
    fixture.componentRef.setInput('rank', unranked);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Unranked');
  });

  it('falls back to the generic Unranked label when placementMatches is explicitly null', () => {
    fixture.componentRef.setInput('rank', unranked);
    fixture.componentRef.setInput('placementMatches', null);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Unranked');
  });

  it('labels a ranked player with tier and division', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Iron I');
  });

  it('labels Champion with just the tier, since it has no division', () => {
    fixture.componentRef.setInput('rank', champion);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Champion');
  });

  it('ignores placementMatches for a ranked (non-Unranked) player', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.componentRef.setInput('placementMatches', 3);
    fixture.detectChanges();

    expect(fixture.componentInstance.label()).toBe('Iron I');
  });

  it.each([
    ['Unranked', unranked],
    ['Iron', ironI],
    ['Champion', champion]
  ] as const)('resolves color() from RANK_COLORS for %s', (_name, rank) => {
    fixture.componentRef.setInput('rank', rank);
    fixture.detectChanges();

    expect(fixture.componentInstance.color()).toBe(RANK_COLORS[rank.tier]);
  });

  it('defaults compact() to false and showRr() to true', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.detectChanges();

    expect(fixture.componentInstance.compact()).toBe(false);
    expect(fixture.componentInstance.showRr()).toBe(true);
  });

  it('renders unranked-with-progress: label shows progress, no RR', () => {
    fixture.componentRef.setInput('rank', unranked);
    fixture.componentRef.setInput('placementMatches', 3);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.label')?.textContent).toBe('Unranked · 3/10');
    expect(el.querySelector('.rr')).toBeNull();
    expect(el.querySelector('.rank-badge')?.getAttribute('style')).toContain(RANK_COLORS.Unranked);
  });

  it('renders a normal ranked tier with RR shown when showRr() is true and rr is not null', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.label')?.textContent).toBe('Iron I');
    expect(el.querySelector('.rr')?.textContent).toContain('42');
    expect(el.querySelector('.rr')?.textContent).toContain('RR');
  });

  it('hides RR when showRr() is explicitly false, even though rr is not null', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.componentRef.setInput('showRr', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rr')).toBeNull();
  });

  it('renders Champion with no RR (division and rr are both null) and just the tier as label', () => {
    fixture.componentRef.setInput('rank', champion);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.label')?.textContent).toBe('Champion');
    expect(el.querySelector('.rr')).toBeNull();
    expect(el.querySelector('.rank-badge')?.getAttribute('style')).toContain(RANK_COLORS.Champion);
  });

  it('applies the compact class to the host span when compact() is true', () => {
    fixture.componentRef.setInput('rank', ironI);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rank-badge.compact')).toBeTruthy();
  });
});
