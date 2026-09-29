import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LeaderboardComponent } from './leaderboard.component';
import { PlayerService } from '../../core/services/player.service';
import { SeasonService } from '../../core/services/season.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Player } from '../../core/models/player';
import { Season, PlayerSeasonStats } from '../../core/models/season';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: `Player ${id}`, elo: 500, peakElo: 500, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: '', ...overrides
});

const season = (overrides: Partial<Season> = {}): Season => ({
  id: 's1', seasonNumber: 3, name: 'Spring', startedAt: '2026-01-01', endedAt: null, isActive: true,
  compressionFactor: 1, ...overrides
});

const seasonStat = (playerId: string, overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => ({
  seasonId: 's1', playerId, startingElo: 500, currentElo: 500, peakElo: 500, finalRank: 'Gold II', finalRr: 40,
  wins: 0, losses: 0, matchesPlayed: 0, ...overrides
});

describe('LeaderboardComponent', () => {
  let fixture: ComponentFixture<LeaderboardComponent>;
  let component: LeaderboardComponent;
  let i18n: I18nService;
  let playerService: { listActive: ReturnType<typeof vi.fn>; nameMap: ReturnType<typeof vi.fn> };
  let seasonService: { getActive: ReturnType<typeof vi.fn>; leaderboard: ReturnType<typeof vi.fn> };

  async function createComponent(config: {
    players?: Player[]; season?: Season | null; names?: Record<string, string>;
    seasonStats?: PlayerSeasonStats[]; rejectWith?: unknown;
  } = {}): Promise<void> {
    TestBed.resetTestingModule();
    playerService = {
      listActive: config.rejectWith ? vi.fn().mockRejectedValue(config.rejectWith) : vi.fn().mockResolvedValue(config.players ?? []),
      nameMap: vi.fn().mockResolvedValue(config.names ?? {})
    };
    seasonService = {
      getActive: vi.fn().mockResolvedValue(config.season ?? null),
      leaderboard: vi.fn().mockResolvedValue(config.seasonStats ?? [])
    };

    await TestBed.configureTestingModule({
      imports: [LeaderboardComponent],
      providers: [
        provideRouter([]),
        { provide: PlayerService, useValue: playerService },
        { provide: SeasonService, useValue: seasonService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LeaderboardComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
  }

  describe('ngOnInit', () => {
    it('loads active players and defaults scope to allTime when there is no active season', async () => {
      const players = [player('p1')];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      expect(component.players()).toEqual(players);
      expect(component.activeSeason()).toBeNull();
      expect(component.scope).toBe('allTime');
      expect(seasonService.leaderboard).not.toHaveBeenCalled();
    });

    it('defaults scope to season and loads the season leaderboard when there is an active season', async () => {
      const stats = [seasonStat('p1')];
      await createComponent({ season: season(), seasonStats: stats });
      await component.ngOnInit();
      expect(component.scope).toBe('season');
      expect(seasonService.leaderboard).toHaveBeenCalledWith('s1');
      expect(component.seasonStats()).toEqual(stats);
    });

    it('sets an error message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
    });
  });

  describe('rows / filteredRows', () => {
    it('builds all-time rows straight from the players list', async () => {
      const players = [player('p1', { displayName: 'Alice', elo: 700, wins: 3, losses: 1 })];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      const rows = component.filteredRows();
      expect(rows).toEqual([
        { playerId: 'p1', displayName: 'Alice', elo: 700, rank: players[0].rank, placementMatches: 10, wins: 3, losses: 1 }
      ]);
    });

    it('builds season rows from season stats, sorted by elo descending, when scope is season', async () => {
      const stats = [
        seasonStat('low', { currentElo: 400, finalRank: 'Iron I', finalRr: 10 }),
        seasonStat('high', { currentElo: 900, finalRank: null, finalRr: null })
      ];
      await createComponent({ season: season(), seasonStats: stats, names: { low: 'Lo', high: 'Hi' } });
      await component.ngOnInit();
      const rows = component.filteredRows();
      expect(rows.map(r => r.playerId)).toEqual(['high', 'low']);
      // finalRank null parses to Unranked with null division/rr
      expect(rows[0].rank).toEqual({ tier: 'Unranked', division: null, rr: null });
      expect(rows[1].rank).toEqual({ tier: 'Iron', division: 'I', rr: 10 });
      expect(rows[0].placementMatches).toBe(0);
    });

    it('uses the unknown-player translation for a season stat whose id is missing from the name map', async () => {
      await createComponent({ season: season(), seasonStats: [seasonStat('ghost')], names: {} });
      await component.ngOnInit();
      expect(component.filteredRows()[0].displayName).toBe(i18n.t('common.unknownPlayer'));
    });

    it('falls back to all-time rows when scope is season but there is no active season', async () => {
      const players = [player('p1', { displayName: 'Alice' })];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      component.scope = 'season';
      expect(component.filteredRows().map(r => r.playerId)).toEqual(['p1']);
    });

    it('filters by search text case-insensitively', async () => {
      const players = [player('a1', { displayName: 'Alice' }), player('b1', { displayName: 'Bob' })];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      component.search = 'ALI';
      expect(component.filteredRows().map(r => r.playerId)).toEqual(['a1']);
    });

    it('filters by exact tier when tierFilter is a specific tier', async () => {
      const players = [
        player('gold', { rank: { tier: 'Gold', division: 'I', rr: 10 } }),
        player('iron', { rank: { tier: 'Iron', division: 'I', rr: 10 } })
      ];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      component.tierFilter = 'Gold';
      expect(component.filteredRows().map(r => r.playerId)).toEqual(['gold']);
    });

    it('filters to unranked players when tierFilter is "unranked"', async () => {
      const players = [
        player('unranked', { rank: { tier: 'Unranked', division: null, rr: null } }),
        player('gold', { rank: { tier: 'Gold', division: 'I', rr: 10 } })
      ];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      component.tierFilter = 'unranked';
      expect(component.filteredRows().map(r => r.playerId)).toEqual(['unranked']);
    });

    it('returns everyone when tierFilter is "all" and search is empty', async () => {
      const players = [player('a1'), player('b1')];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      expect(component.filteredRows().length).toBe(2);
    });

    it('combines search and tier filters', async () => {
      const players = [
        player('a1', { displayName: 'Alice', rank: { tier: 'Gold', division: 'I', rr: 10 } }),
        player('a2', { displayName: 'Alicia', rank: { tier: 'Iron', division: 'I', rr: 10 } })
      ];
      await createComponent({ players, season: null });
      await component.ngOnInit();
      component.search = 'ali';
      component.tierFilter = 'Gold';
      expect(component.filteredRows().map(r => r.playerId)).toEqual(['a1']);
    });
  });

  describe('rendering', () => {
    it('renders the season toggle and rows when there is an active season and players', async () => {
      const players = [player('p1', { displayName: 'Alice' })];
      await createComponent({ players, season: season(), seasonStats: [seasonStat('p1')], names: { p1: 'Alice' } });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('mat-button-toggle-group')).toBeTruthy();
      const text = el.textContent as string;
      expect(text).toContain('Alice');
    });

    it('renders the empty state when filteredRows is empty and there is no error', async () => {
      await createComponent({ players: [], season: null });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(i18n.t('leaderboard.noMatches'));
    });

    it('renders the error message and hides the empty state message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const errorEl = el.querySelector('.tf-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl!.textContent).toContain(i18n.t('leaderboard.loadError'));
      expect(el.textContent).not.toContain(i18n.t('leaderboard.noMatches'));
    });

    it('does not render the season toggle when there is no active season', async () => {
      await createComponent({ players: [player('p1')], season: null });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-button-toggle-group')).toBeNull();
    });
  });
});
