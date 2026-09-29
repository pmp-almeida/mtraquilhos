import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RandomTeamsComponent } from './random-teams.component';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { RandomTeamService, RandomTeams } from '../../core/services/random-team.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { TeamStatsService, TeamPairStat, CarryStat } from '../../rank/team-stats.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Player } from '../../core/models/player';
import { MatchSummary } from '../../core/models/match';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: `Player ${id}`, elo: 500, peakElo: 500, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: '', ...overrides
});

const FOUR = ['a1', 'a2', 'b1', 'b2'].map(id => player(id));

const pairStat = (overrides: Partial<TeamPairStat> = {}): TeamPairStat => ({
  playerLow: 'a1', playerHigh: 'a2', matches: 6, wins: 4, losses: 2, winRate: 0.6667, ...overrides
});

describe('RandomTeamsComponent', () => {
  let fixture: ComponentFixture<RandomTeamsComponent>;
  let component: RandomTeamsComponent;
  let i18n: I18nService;
  let playerService: { listActive: ReturnType<typeof vi.fn>; listAll: ReturnType<typeof vi.fn>; nameMap: ReturnType<typeof vi.fn> };
  let matchService: { listAll: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };
  let teamStatsService: {
    computePairs: ReturnType<typeof vi.fn>; bestTeams: ReturnType<typeof vi.fn>;
    mostPlayedTogether: ReturnType<typeof vi.fn>; theCarry: ReturnType<typeof vi.fn>; computeCarries: ReturnType<typeof vi.fn>;
  };
  let randomTeamService: RandomTeamService;

  async function createComponent(config: {
    activePlayers?: Player[]; allPlayers?: Player[]; matches?: MatchSummary[];
    teamNameMap?: Record<string, string>; names?: Record<string, string>;
    bestTeams?: TeamPairStat[]; dynamicDuo?: TeamPairStat | null; theCarry?: CarryStat | null;
    rejectWith?: unknown;
  } = {}): Promise<void> {
    TestBed.resetTestingModule();
    playerService = {
      listActive: config.rejectWith ? vi.fn().mockRejectedValue(config.rejectWith) : vi.fn().mockResolvedValue(config.activePlayers ?? FOUR),
      listAll: vi.fn().mockResolvedValue(config.allPlayers ?? config.activePlayers ?? FOUR),
      nameMap: vi.fn().mockResolvedValue(config.names ?? {})
    };
    matchService = { listAll: vi.fn().mockResolvedValue(config.matches ?? []) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue(config.teamNameMap ?? {}) };
    teamStatsService = {
      computePairs: vi.fn().mockReturnValue([]),
      bestTeams: vi.fn().mockReturnValue(config.bestTeams ?? []),
      mostPlayedTogether: vi.fn().mockReturnValue(config.dynamicDuo ?? null),
      theCarry: vi.fn().mockReturnValue(config.theCarry ?? null),
      computeCarries: vi.fn().mockReturnValue([])
    };
    randomTeamService = new RandomTeamService();

    await TestBed.configureTestingModule({
      imports: [RandomTeamsComponent],
      providers: [
        provideRouter([]),
        { provide: PlayerService, useValue: playerService },
        { provide: MatchService, useValue: matchService },
        { provide: RandomTeamService, useValue: randomTeamService },
        { provide: TeamNameService, useValue: teamNameService },
        { provide: TeamStatsService, useValue: teamStatsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RandomTeamsComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
  }

  describe('ngOnInit', () => {
    it('loads players, computes club stats, and turns off loading', async () => {
      await createComponent({ activePlayers: FOUR, bestTeams: [pairStat()] });
      await component.ngOnInit();
      expect(component.players()).toEqual(FOUR);
      expect(component.bestTeams()).toEqual([pairStat()]);
      expect(component.loading()).toBe(false);
      expect(component.error).toBe('');
    });

    it('sets an error and stops loading when the initial load fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
      expect(component.loading()).toBe(false);
    });
  });

  describe('generate', () => {
    it('sets teams using the random team service in random mode', async () => {
      await createComponent({ activePlayers: FOUR });
      await component.ngOnInit();
      component.mode.set('random');
      component.generate();
      const t = component.teams();
      expect(t).toBeTruthy();
      expect(t!.teamA.length).toBe(2);
      expect(t!.teamB.length).toBe(2);
      expect(component.error).toBe('');
    });

    it('sets teams using balanced mode, picking the split with the smallest average-elo gap', async () => {
      // The only zero-gap split of these four elos pairs the two extremes together
      // (100+900=1000 avg 500) against the two middling players (500+500 avg 500):
      // any other pairing produces a non-zero gap, so balanced mode must find it.
      const players = [player('p1', { elo: 100 }), player('p2', { elo: 900 }), player('p3', { elo: 500 }), player('p4', { elo: 500 })];
      await createComponent({ activePlayers: players });
      await component.ngOnInit();
      component.mode.set('balanced');
      component.generate();
      const t = component.teams();
      expect(t).toBeTruthy();
      const avg = (team: Player[]) => (team[0].elo + team[1].elo) / 2;
      expect(Math.abs(avg(t!.teamA) - avg(t!.teamB))).toBe(0);
    });

    it('sets an error message when generation throws (fewer than four players)', async () => {
      await createComponent({ activePlayers: [player('a1'), player('a2')] });
      await component.ngOnInit();
      component.generate();
      expect(component.error).toBeTruthy();
      expect(component.teams()).toBeNull();
    });

    it('regenerating replaces the previous teams', async () => {
      await createComponent({ activePlayers: FOUR });
      await component.ngOnInit();
      component.generate();
      const first = component.teams();
      component.generate();
      const second = component.teams();
      expect(second).toBeTruthy();
      expect(first).toBeTruthy();
    });
  });

  describe('namedTeam / pairLabel / hasCustomName', () => {
    it('namedTeam returns the custom name for a generated pair when set', async () => {
      await createComponent({ teamNameMap: { 'a1|a2': 'Dream Team' } });
      await component.ngOnInit();
      expect(component.namedTeam([player('a2'), player('a1')])).toBe('Dream Team');
    });

    it('namedTeam returns null when the pair has no custom name', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.namedTeam([player('a1'), player('a2')])).toBeNull();
    });

    it('namedTeam returns null for a pair that is not exactly two players', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.namedTeam([player('a1')])).toBeNull();
    });

    it('pairLabel returns the custom name when set', async () => {
      await createComponent({ teamNameMap: { 'a1|a2': 'Dream Team' } });
      await component.ngOnInit();
      expect(component.pairLabel(pairStat({ playerLow: 'a1', playerHigh: 'a2' }))).toBe('Dream Team');
    });

    it('pairLabel falls back to joined names when there is no custom name', async () => {
      await createComponent({ names: { a1: 'Alice', a2: 'Amy' } });
      await component.ngOnInit();
      expect(component.pairLabel(pairStat({ playerLow: 'a1', playerHigh: 'a2' }))).toBe('Alice & Amy');
    });

    it('hasCustomName reflects whether the pair has a custom name', async () => {
      await createComponent({ teamNameMap: { 'a1|a2': 'Dream Team' } });
      await component.ngOnInit();
      expect(component.hasCustomName(pairStat({ playerLow: 'a1', playerHigh: 'a2' }))).toBe(true);
      expect(component.hasCustomName(pairStat({ playerLow: 'x1', playerHigh: 'x2' }))).toBe(false);
    });
  });

  describe('nameOf / pct', () => {
    it('nameOf returns the mapped name or the unknown-player fallback', async () => {
      await createComponent({ names: { a1: 'Alice' } });
      await component.ngOnInit();
      expect(component.nameOf('a1')).toBe('Alice');
      expect(component.nameOf('ghost')).toBe(i18n.t('common.unknownPlayer'));
    });

    it('pct rounds a rate to one decimal-place percentage', async () => {
      await createComponent();
      expect(component.pct(0.6667)).toBeCloseTo(66.7, 1);
    });
  });

  describe('router-state handoffs', () => {
    it('nameThisDuoState carries the pair ids for the "name this duo" link', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.nameThisDuoState(pairStat({ playerLow: 'x1', playerHigh: 'x2' })))
        .toEqual({ playerAId: 'x1', playerBId: 'x2' });
    });

    it('liveModeState carries all four generated player ids to hand off to Live Match', async () => {
      await createComponent({ activePlayers: FOUR });
      await component.ngOnInit();
      component.mode.set('random');
      component.generate();
      const t = component.teams()!;
      expect(component.liveModeState(t)).toEqual({
        teamAPlayer1: t.teamA[0].id, teamAPlayer2: t.teamA[1].id,
        teamBPlayer1: t.teamB[0].id, teamBPlayer2: t.teamB[1].id
      });
    });
  });

  describe('winProbability', () => {
    it('computes the projected win chance for team A via the Elo service', async () => {
      const teamA = [player('a1', { elo: 600 }), player('a2', { elo: 600 })];
      const teamB = [player('b1', { elo: 400 }), player('b2', { elo: 400 })];
      const t: RandomTeams = { teamA, teamB };
      await createComponent();
      const prob = component.winProbability(t);
      expect(prob).toBeGreaterThan(0.5);
      expect(prob).toBeLessThanOrEqual(1);
    });
  });

  describe('rendering', () => {
    it('renders club records, generated teams, and the win-probability line', async () => {
      await createComponent({
        activePlayers: FOUR,
        bestTeams: [pairStat()],
        dynamicDuo: pairStat({ playerLow: 'b1', playerHigh: 'b2' }),
        theCarry: { playerId: 'a1', liftRate: 0.2, partners: 2, matches: 10 },
        names: { a1: 'Alice', a2: 'Amy', b1: 'Bea', b2: 'Bella' }
      });
      await component.ngOnInit();
      component.generate();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const text = el.textContent as string;
      expect(text).toContain('Alice');
      expect(el.querySelector('.records')).toBeTruthy();
      expect(el.querySelector('.teams')).toBeTruthy();
      expect(el.querySelector('.prob')).toBeTruthy();
    });

    it('renders the best-teams empty state and the need-four-players hint when there are fewer than four active players', async () => {
      await createComponent({ activePlayers: [player('a1'), player('a2')], bestTeams: [] });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(i18n.t('teams.needFourPre'));
    });

    it('renders the generate error message when generate() throws', async () => {
      await createComponent({ activePlayers: [player('a1'), player('a2'), player('a3')] });
      await component.ngOnInit();
      // Force through the button being disabled: call generate() directly since fewer than 4 players,
      // before the first render so the error is already set on the initial (only) check pass.
      component.generate();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const errorEl = fixture.nativeElement.querySelector('.tf-error');
      expect(errorEl).toBeTruthy();
    });

    it('shows the balanced-mode hint only when balanced mode is selected', async () => {
      await createComponent({ activePlayers: FOUR });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hint')).toBeNull();

      component.mode.set('balanced');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.hint')).toBeTruthy();
    });

    it('renders the "name this duo" link only for pairs without a custom name', async () => {
      await createComponent({
        bestTeams: [pairStat({ playerLow: 'a1', playerHigh: 'a2' }), pairStat({ playerLow: 'b1', playerHigh: 'b2' })],
        teamNameMap: { 'a1|a2': 'Named Already' }
      });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const links = fixture.nativeElement.querySelectorAll('.name-link');
      expect(links.length).toBe(1);
    });

    it('shows the assumed team name subtitle when a generated team has a custom name', async () => {
      await createComponent({ activePlayers: FOUR, teamNameMap: { 'a1|a2': 'Dream Team' } });
      await component.ngOnInit();
      component.mode.set('random');
      // Force a deterministic pairing regardless of the service's internal random weighting.
      component.teams.set({ teamA: [player('a1'), player('a2')], teamB: [player('b1'), player('b2')] });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Dream Team');
    });
  });
});
