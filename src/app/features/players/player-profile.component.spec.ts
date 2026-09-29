import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { PlayerProfileComponent } from './player-profile.component';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { SeasonService } from '../../core/services/season.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { Player } from '../../core/models/player';
import { MatchSummary } from '../../core/models/match';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: id, elo: 520, peakElo: 520, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 3, losses: 2, isActive: true, createdAt: '', ...overrides
});

const match = (id: string, teamA: [string, string], teamB: [string, string], winner: 'A' | 'B'): MatchSummary => ({
  id, playedAt: '', winner, scoreA: null, scoreB: null, seasonId: null,
  teamAPlayerIds: teamA, teamBPlayerIds: teamB, playerIds: [...teamA, ...teamB]
});

describe('PlayerProfileComponent', () => {
  let fixture: ComponentFixture<PlayerProfileComponent>;
  let component: PlayerProfileComponent;
  let paramMap$: Subject<ReturnType<typeof convertToParamMap>>;
  let playerService: { getById: ReturnType<typeof vi.fn>; nameMap: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> };
  let matchService: { listForPlayer: ReturnType<typeof vi.fn> };
  let seasonService: { historyForPlayer: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(): Promise<void> {
    TestBed.resetTestingModule();
    paramMap$ = new Subject();
    playerService = {
      getById: vi.fn().mockResolvedValue(player('p1')),
      nameMap: vi.fn().mockResolvedValue({ p1: 'p1', p2: 'p2' }),
      setActive: vi.fn().mockResolvedValue(undefined)
    };
    matchService = { listForPlayer: vi.fn().mockResolvedValue([]) };
    seasonService = { historyForPlayer: vi.fn().mockResolvedValue([]) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue({}) };

    await TestBed.configureTestingModule({
      imports: [PlayerProfileComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
        { provide: PlayerService, useValue: playerService },
        { provide: MatchService, useValue: matchService },
        { provide: SeasonService, useValue: seasonService },
        { provide: TeamNameService, useValue: teamNameService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerProfileComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => vi.restoreAllMocks());

  function emit(id: string): void {
    paramMap$.next(convertToParamMap({ id }));
  }

  describe('route-reuse regression: loading a second profile via the same route config', () => {
    it('re-loads when the route param changes without a fresh component instance', async () => {
      await createComponent();
      component.ngOnInit();
      playerService.getById.mockResolvedValue(player('p1'));
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      expect(component.player()?.id).toBe('p1');

      playerService.getById.mockResolvedValue(player('p2'));
      emit('p2');
      await Promise.resolve();
      await Promise.resolve();
      expect(component.player()?.id).toBe('p2');
      expect(playerService.getById).toHaveBeenCalledWith('p2');
    });

    it('does not let a slower, stale load clobber a newer, faster one', async () => {
      await createComponent();
      component.ngOnInit();

      let resolveFirst!: (p: Player) => void;
      const firstLoad = new Promise<Player>(resolve => { resolveFirst = resolve; });
      playerService.getById.mockReturnValueOnce(firstLoad);
      emit('slow');
      await Promise.resolve();

      playerService.getById.mockResolvedValueOnce(player('fast'));
      emit('fast');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(component.player()?.id).toBe('fast');

      // The slow navigation's load finally resolves after the fast one already landed -- it must not overwrite it.
      resolveFirst(player('slow'));
      await Promise.resolve();
      await Promise.resolve();
      expect(component.player()?.id).toBe('fast');
    });
  });

  describe('loadPlayer', () => {
    it('shows a "no player specified" error for an empty id', async () => {
      await createComponent();
      component.ngOnInit();
      emit('');
      await Promise.resolve();
      await Promise.resolve();
      expect(component.error).not.toBe('');
      expect(component.loading()).toBe(false);
    });

    it('shows a "not found" error when the player does not exist', async () => {
      await createComponent();
      playerService.getById.mockResolvedValue(null);
      component.ngOnInit();
      emit('ghost');
      await Promise.resolve();
      await Promise.resolve();
      expect(component.error).not.toBe('');
      expect(component.player()).toBeNull();
    });

    it('sets a load error, but only for a load that is still current, when a fetch rejects', async () => {
      await createComponent();
      playerService.getById.mockRejectedValue(new Error('offline'));
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(component.error).not.toBe('');
      expect(component.loading()).toBe(false);
    });

    it('populates player, matches, names, season history and team names on success', async () => {
      await createComponent();
      matchService.listForPlayer.mockResolvedValue([match('m1', ['p1', 'p2'], ['p3', 'p4'], 'A')]);
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(component.player()?.id).toBe('p1');
      expect(component.matches()).toHaveLength(1);
      expect(component.loading()).toBe(false);
      expect(component.error).toBe('');
    });
  });

  describe('toggleActive', () => {
    it('flips the player and shows a success snackbar', async () => {
      await createComponent();
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      const current = component.player()!;
      await component.toggleActive(current);
      expect(playerService.setActive).toHaveBeenCalledWith('p1', false);
      expect(component.player()?.isActive).toBe(false);
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('shows an error snackbar when the update fails, and always resets toggling', async () => {
      await createComponent();
      playerService.setActive.mockRejectedValue(new Error('nope'));
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await component.toggleActive(component.player()!);
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.toggling()).toBe(false);
    });

    it('ignores a second call while already toggling', async () => {
      await createComponent();
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      component.toggling.set(true);
      await component.toggleActive(component.player()!);
      expect(playerService.setActive).not.toHaveBeenCalled();
    });
  });

  describe('computed stats', () => {
    async function load(matches: MatchSummary[], overrides: Partial<Player> = {}): Promise<void> {
      await createComponent();
      playerService.getById.mockResolvedValue(player('p1', overrides));
      matchService.listForPlayer.mockResolvedValue(matches);
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    it('winRate is 0 with no matches, and a rounded percentage otherwise', async () => {
      await load([], { wins: 0, losses: 0 });
      expect(component.winRate()).toBe(0);
    });

    it('winRate rounds to one decimal place', async () => {
      await load([], { wins: 1, losses: 2 });
      expect(component.winRate()).toBeCloseTo(33.3, 1);
    });

    it('currentStreak counts consecutive wins from the most recent match, positive for a win streak', async () => {
      await load([match('m3', ['p1', 'x'], ['y', 'z'], 'A'), match('m2', ['p1', 'x'], ['y', 'z'], 'A'), match('m1', ['p1', 'x'], ['y', 'z'], 'B')]);
      expect(component.currentStreak()).toBe(2);
    });

    it('currentStreak is negative for a losing streak', async () => {
      await load([match('m2', ['p1', 'x'], ['y', 'z'], 'B'), match('m1', ['p1', 'x'], ['y', 'z'], 'A')]);
      expect(component.currentStreak()).toBe(-1);
    });

    it('currentStreak is 0 with no matches', async () => {
      await load([]);
      expect(component.currentStreak()).toBe(0);
    });

    it('bestWinStreak finds the longest run of wins across the whole history', async () => {
      await load([
        match('m5', ['p1', 'x'], ['y', 'z'], 'B'),
        match('m4', ['p1', 'x'], ['y', 'z'], 'A'),
        match('m3', ['p1', 'x'], ['y', 'z'], 'A'),
        match('m2', ['p1', 'x'], ['y', 'z'], 'A'),
        match('m1', ['p1', 'x'], ['y', 'z'], 'B')
      ]);
      expect(component.bestWinStreak()).toBe(3);
    });

    it('teammateStats/headToHeadStats are empty before a player id is known', async () => {
      await createComponent();
      expect(component.teammateStats()).toEqual([]);
      expect(component.headToHeadStats()).toEqual([]);
    });

    it('teammateStats and headToHeadStats aggregate from real match history, sorted by matches played', async () => {
      const matches: MatchSummary[] = [];
      for (let i = 0; i < 6; i++) matches.push(match(`ab${i}`, ['p1', 'buddy'], ['rival1', 'rival2'], 'A'));
      for (let i = 0; i < 5; i++) matches.push(match(`ac${i}`, ['p1', 'other'], ['rival1', 'rival2'], 'B'));
      await load(matches);
      expect(component.teammateStats()[0].playerId).toBe('buddy');
      expect(component.bestTeammate()?.playerId).toBe('buddy');
      expect(component.headToHeadStats().find(s => s.playerId === 'rival1')?.matches).toBe(11);
      expect(component.worstMatchup()).not.toBeNull();
    });
  });

  describe('display helpers', () => {
    beforeEach(async () => {
      await createComponent();
      matchService.listForPlayer.mockResolvedValue([match('m1', ['p1', 'p2'], ['p3', 'p4'], 'A')]);
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('nameOf resolves a known id and falls back for an unknown one', () => {
      expect(component.nameOf('p2')).toBe('p2');
      expect(component.nameOf('ghost')).not.toBe('');
    });

    it('pct rounds a rate to one decimal as a percentage', () => {
      expect(component.pct(0.5)).toBe(50);
      expect(component.pct(1 / 3)).toBeCloseTo(33.3, 1);
    });

    it('streakLabel formats zero, positive and negative streaks distinctly', () => {
      const zero = component.streakLabel(0);
      const win = component.streakLabel(3);
      const loss = component.streakLabel(-2);
      expect(zero).not.toBe(win);
      expect(win).not.toBe(loss);
      expect(win).toContain('3');
      expect(loss).toContain('2');
    });

    it('wonMatch is true when this player was on the winning side, from either side', () => {
      expect(component.wonMatch(match('m', ['p1', 'x'], ['y', 'z'], 'A'))).toBe(true);
      expect(component.wonMatch(match('m', ['y', 'z'], ['p1', 'x'], 'B'))).toBe(true);
      expect(component.wonMatch(match('m', ['p1', 'x'], ['y', 'z'], 'B'))).toBe(false);
    });

    it('teammateName finds the other player on this player\'s own side', () => {
      expect(component.teammateName(match('m', ['p1', 'p2'], ['p3', 'p4'], 'A'))).toBe('p2');
    });

    it('opponentNames falls back to joined display names with no custom team name', () => {
      const m = match('m', ['p1', 'p2'], ['p3', 'p4'], 'A');
      expect(component.opponentNames(m)).toContain('&');
    });

    it('opponentNames prefers a custom team name when one is set for that pair', async () => {
      await createComponent();
      teamNameService.nameMap.mockResolvedValue({ 'p3|p4': 'The Wall' });
      matchService.listForPlayer.mockResolvedValue([]);
      component.ngOnInit();
      emit('p1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const m = match('m', ['p1', 'p2'], ['p3', 'p4'], 'A');
      expect(component.opponentNames(m)).toBe('The Wall');
    });
  });

  it('renders the profile without error once loaded', async () => {
    await createComponent();
    matchService.listForPlayer.mockResolvedValue([match('m1', ['p1', 'p2'], ['p3', 'p4'], 'A')]);
    fixture.detectChanges();
    emit('p1');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('p1');
  });
});
