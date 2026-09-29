import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { SeasonService } from '../../core/services/season.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Player } from '../../core/models/player';
import { MatchSummary } from '../../core/models/match';
import { Season } from '../../core/models/season';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: `Player ${id}`, elo: 500, peakElo: 500, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: '', ...overrides
});

const match = (id: string, overrides: Partial<MatchSummary> = {}): MatchSummary => ({
  id, playedAt: '2026-01-01T12:00:00Z', winner: 'A', scoreA: 5, scoreB: 3, seasonId: null,
  teamAPlayerIds: ['a1', 'a2'], teamBPlayerIds: ['b1', 'b2'], playerIds: ['a1', 'a2', 'b1', 'b2'],
  ...overrides
});

const season = (overrides: Partial<Season> = {}): Season => ({
  id: 's1', seasonNumber: 3, name: 'Spring', startedAt: '2026-01-01', endedAt: null, isActive: true,
  compressionFactor: 1, ...overrides
});

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let i18n: I18nService;
  let playerService: { listActive: ReturnType<typeof vi.fn>; nameMap: ReturnType<typeof vi.fn> };
  let matchService: { listRecent: ReturnType<typeof vi.fn>; countAll: ReturnType<typeof vi.fn> };
  let seasonService: { getActive: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };

  async function createComponent(config: {
    players?: Player[]; matches?: MatchSummary[]; matchCount?: number; season?: Season | null;
    names?: Record<string, string>; teamNames?: Record<string, string>;
    rejectWith?: unknown;
  } = {}): Promise<void> {
    TestBed.resetTestingModule();
    playerService = {
      listActive: config.rejectWith ? vi.fn().mockRejectedValue(config.rejectWith) : vi.fn().mockResolvedValue(config.players ?? []),
      nameMap: vi.fn().mockResolvedValue(config.names ?? {})
    };
    matchService = {
      listRecent: vi.fn().mockResolvedValue(config.matches ?? []),
      countAll: vi.fn().mockResolvedValue(config.matchCount ?? 0)
    };
    seasonService = { getActive: vi.fn().mockResolvedValue(config.season ?? null) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue(config.teamNames ?? {}) };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: PlayerService, useValue: playerService },
        { provide: MatchService, useValue: matchService },
        { provide: SeasonService, useValue: seasonService },
        { provide: TeamNameService, useValue: teamNameService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
  }

  describe('ngOnInit', () => {
    it('loads players, matches, match count, active season, and name maps', async () => {
      const players = [player('p1', { elo: 600 })];
      const matches = [match('m1')];
      await createComponent({ players, matches, matchCount: 7, season: season() });
      await component.ngOnInit();
      expect(component.players()).toEqual(players);
      expect(component.matches()).toEqual(matches);
      expect(component.matchCount()).toBe(7);
      expect(component.activeSeason()).toEqual(season());
      expect(component.error).toBe('');
    });

    it('sets an error message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('network down') });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
      expect(component.players()).toEqual([]);
    });
  });

  describe('computed leaders', () => {
    it('topByElo picks the highest elo player', async () => {
      const players = [player('low', { elo: 400 }), player('high', { elo: 900 }), player('mid', { elo: 600 })];
      await createComponent({ players });
      await component.ngOnInit();
      expect(component.topByElo()?.id).toBe('high');
    });

    it('topByElo is null when there are no players', async () => {
      await createComponent({ players: [] });
      await component.ngOnInit();
      expect(component.topByElo()).toBeNull();
    });

    it('topByWins picks the player with most wins', async () => {
      const players = [player('a', { wins: 2 }), player('b', { wins: 9 }), player('c', { wins: 5 })];
      await createComponent({ players });
      await component.ngOnInit();
      expect(component.topByWins()?.id).toBe('b');
    });

    it('topByWinRate excludes players with zero matches and picks the highest rate', async () => {
      const players = [
        player('noMatches', { wins: 0, losses: 0 }),
        player('low', { wins: 1, losses: 9 }),
        player('high', { wins: 9, losses: 1 })
      ];
      await createComponent({ players });
      await component.ngOnInit();
      expect(component.topByWinRate()?.id).toBe('high');
    });

    it('topByWinRate is null when no player has played a match', async () => {
      const players = [player('a', { wins: 0, losses: 0 })];
      await createComponent({ players });
      await component.ngOnInit();
      expect(component.topByWinRate()).toBeNull();
    });
  });

  describe('winRateOf', () => {
    it('returns 0 when the player has no matches', async () => {
      await createComponent();
      expect(component.winRateOf(player('a', { wins: 0, losses: 0 }))).toBe(0);
    });

    it('rounds to one decimal place as a percentage', async () => {
      await createComponent();
      expect(component.winRateOf(player('a', { wins: 1, losses: 2 }))).toBeCloseTo(33.3, 1);
    });
  });

  describe('teamNames', () => {
    it('uses the custom team name when one exists', async () => {
      await createComponent({ teamNames: { 'a1|a2': 'The Dream Team' } });
      await component.ngOnInit();
      expect(component.teamNames(['a2', 'a1'])).toBe('The Dream Team');
    });

    it('falls back to joined player display names when no custom name exists', async () => {
      await createComponent({ names: { a1: 'Alice', a2: 'Amy' } });
      await component.ngOnInit();
      expect(component.teamNames(['a1', 'a2'])).toBe('Alice & Amy');
    });

    it('falls back to the unknown-player translation for ids missing from the name map', async () => {
      await createComponent({ names: {} });
      await component.ngOnInit();
      const result = component.teamNames(['ghost1', 'ghost2']);
      expect(result).toContain(i18n.t('common.unknownPlayer'));
    });
  });

  describe('rendering', () => {
    it('renders the loaded state with players, top cards and recent matches', async () => {
      const players = [
        player('p1', { displayName: 'Alice', elo: 900, wins: 10, losses: 0 }),
        player('p2', { displayName: 'Bob', elo: 400, wins: 1, losses: 9 })
      ];
      const matches = [match('m1', { teamAPlayerIds: ['p1', 'p2'], teamBPlayerIds: ['x1', 'x2'] })];
      await createComponent({ players, matches, matchCount: 42, season: season(), names: { p1: 'Alice', p2: 'Bob' } });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Alice');
      expect(text).toContain('42');
      expect(fixture.nativeElement.querySelector('.tf-error')).toBeNull();
    });

    it('renders empty states when there are no players and no matches', async () => {
      await createComponent({ players: [], matches: [], season: null });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(i18n.t('dashboard.noActivePlayers'));
      expect(text).toContain(i18n.t('dashboard.noMatches'));
    });

    it('renders the error message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('.tf-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain(i18n.t('dashboard.loadError'));
    });

    it('renders a dash for the score of a match with no recorded score', async () => {
      const matches = [match('m1', { scoreA: null, scoreB: null })];
      await createComponent({ matches });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(i18n.t('common.dash'));
    });
  });
});
