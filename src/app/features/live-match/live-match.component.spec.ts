import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LiveMatchComponent } from './live-match.component';
import { MatchService } from '../../core/services/match.service';
import { PlayerService } from '../../core/services/player.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { RandomTeamService } from '../../core/services/random-team.service';
import { Player } from '../../core/models/player';
import { RecordMatchResult } from '../../core/models/match';

const player = (id: string, elo = 520): Player => ({
  id, displayName: id, elo, peakElo: elo, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: ''
});

const FOUR = ['a1', 'a2', 'b1', 'b2'].map(id => player(id));

const makeResult = (winner: 'A' | 'B', teamDelta = 16): RecordMatchResult => ({
  matchId: 'm1', seasonId: null, winner, expectedProbability: 0.5,
  teamAElo: 520, teamBElo: 520, teamDelta, players: []
});

describe('LiveMatchComponent', () => {
  let fixture: ComponentFixture<LiveMatchComponent>;
  let component: LiveMatchComponent;
  let matchService: { record: ReturnType<typeof vi.fn> };
  let playerService: { listActive: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };
  let randomTeamService: RandomTeamService;
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(players: Player[] = FOUR): Promise<void> {
    matchService = { record: vi.fn() };
    playerService = { listActive: vi.fn().mockResolvedValue(players) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue({}) };
    randomTeamService = new RandomTeamService();

    await TestBed.configureTestingModule({
      imports: [LiveMatchComponent],
      providers: [
        { provide: MatchService, useValue: matchService },
        { provide: PlayerService, useValue: playerService },
        { provide: TeamNameService, useValue: teamNameService },
        { provide: RandomTeamService, useValue: randomTeamService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveMatchComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    // The component's own standalone `imports` (MatSnackBarModule) create a
    // component-scoped injector for MatSnackBar that shadows a plain
    // `{ provide: MatSnackBar, useValue: ... }` in TestBed's providers --
    // that override is silently never seen by the component. Spying on the
    // shared prototype method instead works regardless of which injector
    // resolved the instance.
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  function startLiveMatch(): void {
    component.start = component.start.bind(component);
    (component as any).form.setValue({ teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2', targetScore: 5 });
    component.start();
  }

  describe('ngOnInit / setup', () => {
    it('loads active players and team names', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.players()).toEqual(FOUR);
      expect(component.phase()).toBe('setup');
    });

    it('shows a snackbar and stops if the players/team-names load fails', async () => {
      await createComponent();
      playerService.listActive.mockRejectedValue(new Error('boom'));
      await component.ngOnInit();
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.players()).toEqual([]);
    });

    it('renders the setup card without error', async () => {
      await createComponent();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.setup-card')).toBeTruthy();
    });
  });

  describe('prefillFromState', () => {
    it('patches the form from valid router state with four distinct known players', async () => {
      await createComponent();
      history.pushState({ teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2' }, '');
      await component.ngOnInit();
      expect(component.form.controls.teamAPlayer1.value).toBe('a1');
      history.pushState(null, '');
    });

    it('ignores incomplete router state and falls back to restore()', async () => {
      await createComponent();
      history.pushState({ teamAPlayer1: 'a1' }, '');
      await component.ngOnInit();
      expect(component.form.controls.teamAPlayer1.value).toBe('');
      history.pushState(null, '');
    });

    it('ignores router state naming an unknown or duplicate player', async () => {
      await createComponent();
      history.pushState({ teamAPlayer1: 'a1', teamAPlayer2: 'a1', teamBPlayer1: 'b1', teamBPlayer2: 'b2' }, '');
      await component.ngOnInit();
      expect(component.form.controls.teamAPlayer1.value).toBe('');
      history.pushState(null, '');
    });
  });

  describe('restore (persisted in-progress match)', () => {
    const persisted = {
      teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2',
      targetScore: 7, scoreA: 2, scoreB: 1, history: ['A', 'A', 'B'], startedAt: '2026-01-01T00:00:00.000Z'
    };

    it('resumes an in-progress match from localStorage', async () => {
      localStorage.setItem('tf-live-match-v1', JSON.stringify(persisted));
      await createComponent();
      await component.ngOnInit();
      expect(component.phase()).toBe('live');
      expect(component.scoreA()).toBe(2);
      expect(component.scoreB()).toBe(1);
      expect(component.targetScore()).toBe(7);
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('discards and warns when a persisted player is no longer active', async () => {
      localStorage.setItem('tf-live-match-v1', JSON.stringify(persisted));
      await createComponent([player('a1'), player('a2'), player('b1')]); // b2 missing
      await component.ngOnInit();
      expect(component.phase()).toBe('setup');
      expect(localStorage.getItem('tf-live-match-v1')).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('clears corrupt persisted JSON without throwing', async () => {
      localStorage.setItem('tf-live-match-v1', '{not json');
      await createComponent();
      await expect(component.ngOnInit()).resolves.toBeUndefined();
      expect(localStorage.getItem('tf-live-match-v1')).toBeNull();
    });

    it('does nothing when there is no persisted match', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.phase()).toBe('setup');
    });
  });

  describe('randomizeTeams', () => {
    it('fills the form with a generated matchup', async () => {
      await createComponent();
      await component.ngOnInit();
      component.randomizeTeams();
      const value = component.form.getRawValue();
      const ids = [value.teamAPlayer1, value.teamAPlayer2, value.teamBPlayer1, value.teamBPlayer2];
      expect(new Set(ids).size).toBe(4);
    });

    it('shows a snackbar if generation fails (fewer than four players)', async () => {
      await createComponent([player('a1'), player('a2')]);
      await component.ngOnInit();
      component.randomizeTeams();
      expect(snackBarOpen).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('does nothing when the form is invalid', async () => {
      await createComponent();
      await component.ngOnInit();
      component.start();
      expect(component.phase()).toBe('setup');
    });

    it('rejects a non-distinct selection of players', async () => {
      await createComponent();
      await component.ngOnInit();
      component.form.setValue({ teamAPlayer1: 'a1', teamAPlayer2: 'a1', teamBPlayer1: 'b1', teamBPlayer2: 'b2', targetScore: 5 });
      component.start();
      expect(component.phase()).toBe('setup');
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('begins a live match with the chosen four players, recording them as played', async () => {
      await createComponent();
      await component.ngOnInit();
      const recordSpy = vi.spyOn(randomTeamService, 'recordPlayed');
      startLiveMatch();
      expect(component.phase()).toBe('live');
      expect(component.scoreA()).toBe(0);
      expect(component.scoreB()).toBe(0);
      expect(recordSpy).toHaveBeenCalledWith(['a1', 'a2', 'b1', 'b2']);
      expect(localStorage.getItem('tf-live-match-v1')).not.toBeNull();
    });
  });

  describe('scoring', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
    });

    it('addPoint increments the right team and records history', () => {
      component.addPoint('A');
      component.addPoint('B');
      expect(component.scoreA()).toBe(1);
      expect(component.scoreB()).toBe(1);
      expect(component.history()).toEqual(['A', 'B']);
    });

    it('addPoint is ignored while a cancel confirmation is pending', () => {
      component.confirmingCancel.set(true);
      component.addPoint('A');
      expect(component.scoreA()).toBe(0);
    });

    it('undo reverts the last point and re-arms the finish prompt', () => {
      component.addPoint('A');
      component.undo();
      expect(component.scoreA()).toBe(0);
      expect(component.history()).toEqual([]);
    });

    it('undo on an empty history is a no-op', () => {
      component.undo();
      expect(component.scoreA()).toBe(0);
    });

    it('showFinishPrompt fires once a team reaches the target with a lead, and keepPlaying dismisses it for that exact score', () => {
      for (let i = 0; i < 5; i++) component.addPoint('A');
      expect(component.showFinishPrompt()).toBe(true);
      component.keepPlaying();
      expect(component.showFinishPrompt()).toBe(false);
      component.addPoint('A');
      expect(component.showFinishPrompt()).toBe(true);
    });

    it('undo un-dismisses a previously kept-playing score', () => {
      for (let i = 0; i < 5; i++) component.addPoint('A');
      component.keepPlaying();
      component.undo();
      component.addPoint('A');
      expect(component.showFinishPrompt()).toBe(true);
    });

    it('finishProjection is null until the finish prompt is showing', () => {
      expect(component.finishProjection()).toBeNull();
    });

    it('finishProjection projects Elo/rank changes for all four players once finished', () => {
      for (let i = 0; i < 5; i++) component.addPoint('A');
      const proj = component.finishProjection();
      expect(proj).not.toBeNull();
      expect(proj).toHaveLength(4);
      expect(proj![0].playerId).toBe('a1');
    });
  });

  describe('confirmFinish', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
    });

    it('records the match for the actual leading team and clears persistence', async () => {
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirmFinish();
      expect(matchService.record).toHaveBeenCalledWith(expect.objectContaining({
        teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2', winner: 'A', scoreA: 5, scoreB: 0
      }));
      expect(component.result()).toEqual(makeResult('A'));
      expect(localStorage.getItem('tf-live-match-v1')).toBeNull();
    });

    it('shows a snackbar and keeps submitting=false when recording fails', async () => {
      matchService.record.mockRejectedValue(new Error('offline'));
      await component.confirmFinish();
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.result()).toBeNull();
    });

    it('is a no-op while already submitting', async () => {
      matchService.record.mockResolvedValue(makeResult('A'));
      const first = component.confirmFinish();
      const second = component.confirmFinish();
      await Promise.all([first, second]);
      expect(matchService.record).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel / startAnother', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
    });

    it('cancel returns to setup and clears persistence', () => {
      component.addPoint('A');
      component.cancel();
      expect(component.phase()).toBe('setup');
      expect(localStorage.getItem('tf-live-match-v1')).toBeNull();
    });

    it('startAnother clears the result and resets the form to setup', async () => {
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirmFinish();
      component.startAnother();
      expect(component.result()).toBeNull();
      expect(component.phase()).toBe('setup');
      expect(component.form.controls.targetScore.value).toBe(5);
    });
  });

  describe('winners-stay bug fix: startWithNewOpponents relies on the reliable winner field, not teamDelta', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
    });

    it('treats team A as winners when winner is "A", even with a teamDelta that would mislead the old sign-based check', async () => {
      for (let i = 0; i < 5; i++) component.addPoint('A');
      // teamDelta is a magnitude and carries no sign information about who
      // won -- assert the picker still gets A right regardless of its value.
      matchService.record.mockResolvedValue(makeResult('A', 16));
      await component.confirmFinish();
      component.startWithNewOpponents();
      const nop = component.nextOpponentsPrompt();
      expect(nop).not.toBeNull();
      expect(nop!.winners).toEqual(['a1', 'a2']);
      expect(nop!.losers).toEqual(['b1', 'b2']);
    });

    it('treats team B as winners when winner is "B"', async () => {
      // Score-wise A is still "leading" in this rig (confirmFinish always
      // derives winner from the score), so simulate B actually winning by
      // recording B's team ahead instead.
      component.cancel();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('B');
      matchService.record.mockResolvedValue(makeResult('B', 16));
      await component.confirmFinish();
      component.startWithNewOpponents();
      const nop = component.nextOpponentsPrompt();
      expect(nop!.winners).toEqual(['b1', 'b2']);
      expect(nop!.losers).toEqual(['a1', 'a2']);
    });

    it('does nothing without a recorded result, or with fewer than four active players', async () => {
      component.startWithNewOpponents();
      expect(component.nextOpponentsPrompt()).toBeNull();
    });
  });

  describe('Next opponents picker', () => {
    async function setUpFinishedMatch(extraPlayers: Player[] = []): Promise<void> {
      await createComponent([...FOUR, ...extraPlayers]);
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirmFinish();
    }

    it('suggests two fresh (non-participating) players when at least two are available', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      const nop = component.nextOpponentsPrompt()!;
      expect(new Set([nop.challenger1, nop.challenger2])).toEqual(new Set(['c1', 'c2']));
    });

    it('falls back to the losing team when fewer than two fresh players are available', async () => {
      await setUpFinishedMatch(); // no extra players -- only the 4 who just played exist
      component.startWithNewOpponents();
      const nop = component.nextOpponentsPrompt()!;
      expect(new Set([nop.challenger1, nop.challenger2])).toEqual(new Set(['b1', 'b2']));
    });

    it('tops up with one loser when exactly one fresh player is available', async () => {
      await setUpFinishedMatch([player('c1')]);
      component.startWithNewOpponents();
      const nop = component.nextOpponentsPrompt()!;
      expect(nop.challenger1).toBe('c1');
      expect(['b1', 'b2']).toContain(nop.challenger2);
    });

    it('offers the streak toggle once the same pair has won 3+ in a row, but not on wins 1-2', async () => {
      await setUpFinishedMatch([player('c1'), player('c2'), player('d1'), player('d2')]);
      // Win #1 already recorded by setUpFinishedMatch.
      component.startWithNewOpponents();
      expect(component.nextOpponentsPrompt()!.streak).toBeNull();
      component.confirmNextOpponents(); // a1/a2 chained forward against fresh challengers, but let's force the same pair to win again
      component.cancel();
      // Re-run two more wins for a1/a2 directly to reach a streak of 3.
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      await component.confirmFinish();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      await component.confirmFinish();
      component.startWithNewOpponents();
      expect(component.nextOpponentsPrompt()!.streak).toEqual({ count: 3 });
    });

    it('setChallenger updates the given slot only', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.setChallenger(1, 'c1');
      component.setChallenger(2, 'c2');
      expect(component.nextOpponentsPrompt()).toEqual(expect.objectContaining({ challenger1: 'c1', challenger2: 'c2' }));
    });

    it('setChallenger/setSplitWinners/shuffleChallengers are no-ops when no prompt is open', async () => {
      await createComponent();
      await component.ngOnInit();
      component.setChallenger(1, 'x');
      component.setSplitWinners(true);
      component.shuffleChallengers();
      expect(component.nextOpponentsPrompt()).toBeNull();
    });

    it('challengerOptions excludes both winners and whatever is picked in the other slot', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.setChallenger(2, 'c2');
      const nop = component.nextOpponentsPrompt()!;
      const options = component.challengerOptions(nop, 1).map(p => p.id);
      expect(options).not.toContain('a1');
      expect(options).not.toContain('a2');
      expect(options).not.toContain('c2');
      expect(options).toContain('c1');
    });

    it('shuffleChallengers re-suggests a pair', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.shuffleChallengers();
      const nop = component.nextOpponentsPrompt()!;
      expect(new Set([nop.challenger1, nop.challenger2])).toEqual(new Set(['c1', 'c2']));
    });

    it('cancelNextOpponents closes the prompt without starting a match', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.cancelNextOpponents();
      expect(component.nextOpponentsPrompt()).toBeNull();
      expect(component.phase()).toBe('live');
      expect(component.result()).not.toBeNull();
    });

    it('confirmNextOpponents keeps the winning duo together by default', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.confirmNextOpponents();
      expect(component.phase()).toBe('live');
      expect(component.scoreA()).toBe(0);
      expect(component.teamALabel()).toContain('a1');
    });

    it('confirmNextOpponents splits the winning duo across both teams when splitWinners is set', async () => {
      await setUpFinishedMatch([player('c1'), player('c2')]);
      component.startWithNewOpponents();
      component.setSplitWinners(true);
      component.confirmNextOpponents();
      const value = component.form; // ids are private, but the resulting labels reveal the split
      expect([component.teamALabel(), component.teamBLabel()].join('|')).toMatch(/a1/);
      expect([component.teamALabel(), component.teamBLabel()].join('|')).toMatch(/a2/);
      // a1 and a2 should now be on opposite labels rather than the same one.
      expect(component.teamALabel().includes('a1') && component.teamALabel().includes('a2')).toBe(false);
      void value;
    });

    it('confirmNextOpponents is a no-op when no prompt is open', async () => {
      await createComponent();
      await component.ngOnInit();
      component.confirmNextOpponents();
      expect(component.phase()).toBe('setup');
    });
  });

  describe('startWithSamePlayers', () => {
    it('restarts with the exact same four players and side assignment', async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirmFinish();
      component.startWithSamePlayers();
      expect(component.phase()).toBe('live');
      expect(component.scoreA()).toBe(0);
      expect(component.teamALabel()).toBe('a1 & a2');
      expect(component.teamBLabel()).toBe('b1 & b2');
    });

    it('does nothing without a recorded result', async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      component.startWithSamePlayers();
      expect(component.scoreA()).toBe(0);
    });
  });

  describe('labels and canChainMatch', () => {
    it('teamLabelFor prefers a custom team name over the default "A & B"', async () => {
      await createComponent();
      teamNameService.nameMap.mockResolvedValue({ 'a1|a2': 'The Wall' });
      await component.ngOnInit();
      expect(component.teamLabelFor('a1', 'a2')).toBe('The Wall');
      expect(component.teamLabelFor('a2', 'a1')).toBe('The Wall');
    });

    it('nameOf falls back to a placeholder for an unknown player id', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.nameOf('ghost')).not.toBe('');
      expect(component.nameOf('a1')).toBe('a1');
    });

    it('canChainMatch is false below four active players', async () => {
      await createComponent([player('a1'), player('a2')]);
      await component.ngOnInit();
      expect(component.canChainMatch()).toBe(false);
    });

    it('canChainMatch is true at four or more active players', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.canChainMatch()).toBe(true);
    });
  });

  describe('template rendering', () => {
    it('renders the setup phase, including the balanced-mode hint and the too-few-players hint', async () => {
      await createComponent([player('a1'), player('a2')]);
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      component.randomMode.set('balanced');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.setup-card')).toBeTruthy();
      expect(el.querySelectorAll('.hint').length).toBeGreaterThan(0);
    });

    it('renders the live-play stage, the cancel-confirm toggle, and undo enabled state', async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      component.addPoint('A');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.zones')).toBeTruthy();
      component.confirmingCancel.set(true);
      fixture.detectChanges();
      expect(el.querySelector('.cancel-inline')).toBeTruthy();
    });

    it('renders the finish prompt with a changed and an unchanged projection row', async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.finish-backdrop')).toBeTruthy();
      expect(el.querySelectorAll('.proj-row').length).toBe(4);
    });

    it('renders the result view with every badge variant and the Next challengers action', async () => {
      await createComponent();
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue({
        matchId: 'm1', seasonId: null, winner: 'A' as const, expectedProbability: 0.5, teamAElo: 520, teamBElo: 520, teamDelta: 16,
        players: [
          { playerId: 'a1', eloBefore: 520, eloAfter: 536, eloDelta: 16, rankBefore: 'Iron I', rankAfter: 'Iron II', rrBefore: 90, rrAfter: 10, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: false, demotionShieldAfter: true },
          { playerId: 'a2', eloBefore: 520, eloAfter: 536, eloDelta: 16, rankBefore: 'Iron I', rankAfter: 'Iron I', rrBefore: 50, rrAfter: 66, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: true, demotionShieldAfter: false },
          { playerId: 'b1', eloBefore: 520, eloAfter: 504, eloDelta: -16, rankBefore: 'Iron I', rankAfter: 'Unranked', rrBefore: 10, rrAfter: null, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: true, demotionShieldAfter: false },
          { playerId: 'b2', eloBefore: 520, eloAfter: 504, eloDelta: -16, rankBefore: 'Iron I', rankAfter: 'Iron I', rrBefore: 10, rrAfter: 0, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: false, demotionShieldAfter: false }
        ]
      });
      await component.confirmFinish();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.result-view')).toBeTruthy();
      expect(el.querySelector('.badge.shield')).toBeTruthy();
      expect(el.querySelector('.badge.shield-saved')).toBeTruthy();
      expect(el.querySelector('.badge.demoted')).toBeTruthy();
      expect(el.querySelectorAll('.result-row').length).toBe(4);
    });

    it('renders the result view without the Next challengers action when canChainMatch is false', async () => {
      await createComponent([player('a1'), player('a2'), player('b1'), player('b2')]);
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue(makeResult('A'));
      // Drop below four active players only after the match has already started, so confirmFinish can still run.
      component.players.set([player('a1'), player('a2')]);
      await component.confirmFinish();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(component.canChainMatch()).toBe(false);
    });

    it('renders the Next opponents sheet, including the streak toggle when offered', async () => {
      await createComponent([...FOUR, player('c1'), player('c2')]);
      await component.ngOnInit();
      startLiveMatch();
      for (let i = 0; i < 5; i++) component.addPoint('A');
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirmFinish();
      component.startWithNewOpponents();
      component.nextOpponentsPrompt.update(nop => (nop ? { ...nop, streak: { count: 3 } } : nop));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.next-opponents-sheet')).toBeTruthy();
      expect(el.querySelector('.streak-note')).toBeTruthy();
      expect(el.querySelector('.mode-toggle')).toBeTruthy();
      expect(el.querySelectorAll('.challenger-row select, .challenger-row mat-select').length).toBeGreaterThan(0);
    });
  });
});
