import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RecordMatchComponent } from './record-match.component';
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

const makeResult = (winner: 'A' | 'B'): RecordMatchResult => ({
  matchId: 'm1', seasonId: null, winner, expectedProbability: 0.5,
  teamAElo: 520, teamBElo: 520, teamDelta: 16, players: []
});

describe('RecordMatchComponent', () => {
  let fixture: ComponentFixture<RecordMatchComponent>;
  let component: RecordMatchComponent;
  let matchService: { record: ReturnType<typeof vi.fn> };
  let playerService: { listActive: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };
  let randomTeamService: RandomTeamService;
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(players: Player[] = FOUR): Promise<void> {
    TestBed.resetTestingModule();
    matchService = { record: vi.fn() };
    playerService = { listActive: vi.fn().mockResolvedValue(players) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue({}) };
    randomTeamService = new RandomTeamService();

    await TestBed.configureTestingModule({
      imports: [RecordMatchComponent],
      providers: [
        { provide: MatchService, useValue: matchService },
        { provide: PlayerService, useValue: playerService },
        { provide: TeamNameService, useValue: teamNameService },
        { provide: RandomTeamService, useValue: randomTeamService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RecordMatchComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => vi.restoreAllMocks());

  function fillForm(overrides: Partial<{ teamAPlayer1: string; teamAPlayer2: string; teamBPlayer1: string; teamBPlayer2: string; winner: 'A' | 'B'; scoreA: number | null; scoreB: number | null }> = {}): void {
    component.form.setValue({
      teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2',
      winner: 'A', scoreA: null, scoreB: null, ...overrides
    });
  }

  describe('ngOnInit', () => {
    it('loads active players and team names', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.players()).toEqual(FOUR);
    });

    it('shows a snackbar when loading fails', async () => {
      await createComponent();
      playerService.listActive.mockRejectedValue(new Error('boom'));
      await component.ngOnInit();
      expect(snackBarOpen).toHaveBeenCalled();
    });
  });

  describe('auto-selecting the winner from scores', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      fillForm();
      // fillForm's bulk form.setValue() also emits on the winner control itself
      // (even though it sets it to its own default), which the constructor's
      // own "player touched it" subscription picks up -- reset that flag so
      // each test starts from a clean, untouched state, same as a fresh page load.
      (component as unknown as { winnerTouched: boolean }).winnerTouched = false;
    });

    it('suggests the winner as soon as both scores differ, before the winner is touched manually', () => {
      component.form.controls.scoreA.setValue(5);
      component.form.controls.scoreB.setValue(3);
      expect(component.form.controls.winner.value).toBe('A');

      component.form.controls.scoreA.setValue(2);
      component.form.controls.scoreB.setValue(9);
      expect(component.form.controls.winner.value).toBe('B');
    });

    it('stops auto-selecting once the player has touched the winner control themselves', () => {
      component.form.controls.winner.setValue('B'); // manual pick
      component.form.controls.scoreA.setValue(9);
      component.form.controls.scoreB.setValue(1);
      // Auto-select would want 'A' here, but the manual touch should have disabled it.
      expect(component.form.controls.winner.value).toBe('B');
    });

    it('does nothing while either score is still empty, or scores are tied', () => {
      component.form.controls.scoreA.setValue(4);
      expect(component.form.controls.winner.value).toBe('A');
      component.form.controls.scoreA.setValue(3);
      component.form.controls.scoreB.setValue(3);
      expect(component.form.controls.winner.value).toBe('A');
    });

    it('clear() resets winnerTouched so auto-select resumes for the next match', () => {
      component.form.controls.winner.setValue('B');
      component.clear();
      component.form.controls.scoreA.setValue(5);
      component.form.controls.scoreB.setValue(1);
      expect(component.form.controls.winner.value).toBe('A');
    });
  });

  describe('preview', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
    });

    it('does nothing when the form is invalid', () => {
      component.preview();
      expect(component.projection()).toBeNull();
    });

    it('rejects a non-distinct selection of players', () => {
      fillForm({ teamBPlayer2: 'a1' });
      component.preview();
      expect(component.projection()).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('rejects when only one of the two scores is filled in', () => {
      fillForm({ scoreA: 5, scoreB: null });
      component.preview();
      expect(component.projection()).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('rejects a negative score', () => {
      fillForm({ scoreA: -1, scoreB: 3 });
      component.preview();
      expect(component.projection()).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('builds a projection for all four players when valid', () => {
      fillForm({ scoreA: 5, scoreB: 2 });
      component.preview();
      const proj = component.projection();
      expect(proj).not.toBeNull();
      expect(proj!.players).toHaveLength(4);
      expect(proj!.players.map(p => p.team)).toEqual(['A', 'A', 'B', 'B']);
    });

    it('accepts a valid preview with no scores at all', () => {
      fillForm();
      component.preview();
      expect(component.projection()).not.toBeNull();
    });

    it('cancelPreview clears the projection', () => {
      fillForm({ scoreA: 5, scoreB: 2 });
      component.preview();
      component.cancelPreview();
      expect(component.projection()).toBeNull();
    });

    it('namedTeamForSide returns null with no projection, and looks up a custom team name once previewed', async () => {
      expect(component.namedTeamForSide('A')).toBeNull();
      await createComponent();
      teamNameService.nameMap.mockResolvedValue({ 'a1|a2': 'The Wall' });
      await component.ngOnInit();
      fillForm({ scoreA: 5, scoreB: 2 });
      component.preview();
      expect(component.namedTeamForSide('A')).toBe('The Wall');
      expect(component.namedTeamForSide('B')).toBeNull();
    });
  });

  describe('confirm', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      fillForm({ scoreA: 5, scoreB: 2 });
    });

    it('records the match, updates the fairness tracker, and shows the result', async () => {
      matchService.record.mockResolvedValue(makeResult('A'));
      const recordPlayedSpy = vi.spyOn(randomTeamService, 'recordPlayed');
      await component.confirm();
      expect(matchService.record).toHaveBeenCalledWith(expect.objectContaining({
        teamAPlayer1: 'a1', teamAPlayer2: 'a2', teamBPlayer1: 'b1', teamBPlayer2: 'b2', winner: 'A', scoreA: 5, scoreB: 2
      }));
      expect(recordPlayedSpy).toHaveBeenCalledWith(['a1', 'a2', 'b1', 'b2']);
      expect(component.result()).toEqual(makeResult('A'));
      expect(component.projection()).toBeNull();
    });

    it('does nothing when the form is invalid', async () => {
      component.form.controls.teamAPlayer1.setValue('');
      await component.confirm();
      expect(matchService.record).not.toHaveBeenCalled();
    });

    it('is a no-op while already saving', async () => {
      matchService.record.mockResolvedValue(makeResult('A'));
      const first = component.confirm();
      const second = component.confirm();
      await Promise.all([first, second]);
      expect(matchService.record).toHaveBeenCalledTimes(1);
    });

    it('shows a snackbar and keeps the form when recording fails', async () => {
      matchService.record.mockRejectedValue(new Error('offline'));
      await component.confirm();
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.result()).toBeNull();
      expect(component.saving()).toBe(false);
    });
  });

  describe('reset and clear', () => {
    it('reset clears the result, the form, and reloads players', async () => {
      await createComponent();
      await component.ngOnInit();
      fillForm({ scoreA: 5, scoreB: 2 });
      matchService.record.mockResolvedValue(makeResult('A'));
      await component.confirm();
      playerService.listActive.mockClear();
      component.reset();
      await Promise.resolve();
      expect(component.result()).toBeNull();
      expect(playerService.listActive).toHaveBeenCalled();
    });

    it('nameOf falls back for an unknown player id', async () => {
      await createComponent();
      await component.ngOnInit();
      expect(component.nameOf('a1')).toBe('a1');
      expect(component.nameOf('ghost')).not.toBe('');
    });
  });

  it('renders the setup form and, once previewed, the projection', async () => {
    await createComponent();
    await component.ngOnInit();
    fixture.detectChanges();
    await fixture.whenStable();
    fillForm({ scoreA: 5, scoreB: 2 });
    component.preview();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.preview-card')).toBeTruthy();
  });

  it('renders the result view with every badge variant once a match is confirmed', async () => {
    await createComponent();
    await component.ngOnInit();
    fillForm({ scoreA: 5, scoreB: 2 });
    matchService.record.mockResolvedValue({
      matchId: 'm1', seasonId: null, winner: 'A' as const, expectedProbability: 0.5, teamAElo: 520, teamBElo: 520, teamDelta: 16,
      players: [
        { playerId: 'a1', eloBefore: 520, eloAfter: 536, eloDelta: 16, rankBefore: 'Iron I', rankAfter: 'Iron II', rrBefore: 90, rrAfter: 10, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: false, demotionShieldAfter: true },
        { playerId: 'a2', eloBefore: 520, eloAfter: 536, eloDelta: 16, rankBefore: 'Iron I', rankAfter: 'Iron I', rrBefore: 50, rrAfter: 66, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: true, demotionShieldAfter: false },
        { playerId: 'b1', eloBefore: 520, eloAfter: 504, eloDelta: -16, rankBefore: 'Iron I', rankAfter: 'Unranked', rrBefore: 10, rrAfter: null, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: true, demotionShieldAfter: false },
        { playerId: 'b2', eloBefore: 520, eloAfter: 504, eloDelta: -16, rankBefore: 'Iron I', rankAfter: 'Iron I', rrBefore: 10, rrAfter: 0, placementMatchesBefore: 10, placementMatchesAfter: 11, demotionShieldBefore: false, demotionShieldAfter: false }
      ]
    });
    await component.confirm();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.result-card')).toBeTruthy();
    expect(el.querySelector('.badge.shield')).toBeTruthy();
    expect(el.querySelector('.badge.shield-saved')).toBeTruthy();
    expect(el.querySelector('.badge.demoted')).toBeTruthy();
  });
});
