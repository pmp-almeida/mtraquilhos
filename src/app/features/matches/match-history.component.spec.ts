import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatchHistoryComponent } from './match-history.component';
import { MatchService } from '../../core/services/match.service';
import { PlayerService } from '../../core/services/player.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { MatchSummary } from '../../core/models/match';

const match = (overrides: Partial<MatchSummary> = {}): MatchSummary => ({
  id: 'm1', playedAt: '2026-01-01T12:00:00Z', winner: 'A', scoreA: 5, scoreB: 2, seasonId: null,
  teamAPlayerIds: ['a1', 'a2'], teamBPlayerIds: ['b1', 'b2'], playerIds: ['a1', 'a2', 'b1', 'b2'],
  ...overrides
});

describe('MatchHistoryComponent', () => {
  let fixture: ComponentFixture<MatchHistoryComponent>;
  let component: MatchHistoryComponent;
  let matchService: { listRecent: ReturnType<typeof vi.fn>; rewind: ReturnType<typeof vi.fn> };
  let playerService: { nameMap: ReturnType<typeof vi.fn> };
  let teamNameService: { nameMap: ReturnType<typeof vi.fn> };
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(): Promise<void> {
    TestBed.resetTestingModule();
    matchService = { listRecent: vi.fn().mockResolvedValue([]), rewind: vi.fn() };
    playerService = { nameMap: vi.fn().mockResolvedValue({ a1: 'Alice', a2: 'Anna', b1: 'Bob', b2: 'Ben' }) };
    teamNameService = { nameMap: vi.fn().mockResolvedValue({}) };

    await TestBed.configureTestingModule({
      imports: [MatchHistoryComponent],
      providers: [
        { provide: MatchService, useValue: matchService },
        { provide: PlayerService, useValue: playerService },
        { provide: TeamNameService, useValue: teamNameService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MatchHistoryComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => vi.restoreAllMocks());

  describe('ngOnInit', () => {
    it('loads matches, player names, and team names together', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match()]);
      await component.ngOnInit();
      expect(component.matches()).toEqual([match()]);
      expect(matchService.listRecent).toHaveBeenCalledWith(50);
      expect(component.error).toBe('');
    });

    it('sets an error message when any of the loads fail', async () => {
      await createComponent();
      matchService.listRecent.mockRejectedValue(new Error('boom'));
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
      expect(component.matches()).toEqual([]);
    });
  });

  describe('teamNames', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('falls back to joined player display names when there is no custom team name', async () => {
      await component.ngOnInit();
      expect(component.teamNames(['a1', 'a2'])).toBe('Alice & Anna');
    });

    it('uses the unknown-player fallback for an id with no matching name', async () => {
      await component.ngOnInit();
      expect(component.teamNames(['a1', 'ghost'])).toContain('Alice');
      expect(component.teamNames(['a1', 'ghost'])).not.toContain('ghost');
    });

    it('prefers a custom team name when one is set for the pair, regardless of id order', async () => {
      teamNameService.nameMap.mockResolvedValue({ 'a1|a2': 'The Wall' });
      await component.ngOnInit();
      expect(component.teamNames(['a1', 'a2'])).toBe('The Wall');
      expect(component.teamNames(['a2', 'a1'])).toBe('The Wall');
    });
  });

  describe('rewind', () => {
    beforeEach(async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match({ id: 'm1' }), match({ id: 'm2' })]);
      await component.ngOnInit();
    });

    it('is a no-op while a rewind is already in flight', async () => {
      let resolveRewind!: () => void;
      matchService.rewind.mockReturnValue(new Promise<void>(resolve => { resolveRewind = resolve; }));
      const first = component.rewind('m1');
      const second = component.rewind('m2');
      resolveRewind();
      await Promise.all([first, second]);
      expect(matchService.rewind).toHaveBeenCalledTimes(1);
    });

    it('on success: removes the match, clears the confirm prompt, and shows a toast', async () => {
      matchService.rewind.mockResolvedValue(undefined);
      component.confirmingRewindId.set('m1');
      await component.rewind('m1');
      expect(component.matches().map(m => m.id)).toEqual(['m2']);
      expect(component.confirmingRewindId()).toBeNull();
      expect(component.rewindingId()).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('on failure: surfaces the RPC error message (e.g. not the most-recent match) via a toast and keeps the match in the list', async () => {
      matchService.rewind.mockRejectedValue(new Error('Only the most recent match for a player can be rewound.'));
      await component.rewind('m1');
      expect(component.matches().map(m => m.id)).toEqual(['m1', 'm2']);
      expect(snackBarOpen).toHaveBeenCalledWith('Only the most recent match for a player can be rewound.', expect.anything(), expect.anything());
      expect(component.rewindingId()).toBeNull();
    });

    it('falls back to a generic error message when the rejection is not an Error', async () => {
      matchService.rewind.mockRejectedValue('nope');
      await component.rewind('m1');
      const message = snackBarOpen.mock.calls[0][0];
      expect(typeof message).toBe('string');
      expect(message).not.toBe('nope');
    });
  });

  describe('rendering', () => {
    it('renders match rows with resolved names, scores, and winner styling', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match({ scoreA: 5, scoreB: 2, winner: 'A' })]);
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.row')).toBeTruthy();
      expect(el.textContent).toContain('Alice & Anna');
      expect(el.textContent).toContain('Bob & Ben');
      expect(el.textContent).toContain('5');
      expect(el.querySelector('.team.winner')?.textContent).toContain('Alice & Anna');
    });

    it('renders the "not recorded" score label when scoreA is null', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match({ scoreA: null, scoreB: null })]);
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.score')?.textContent).not.toContain('null');
    });

    it('renders the empty state with no matches', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([]);
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.tf-empty')).toBeTruthy();
      expect(el.querySelector('.row')).toBeFalsy();
    });

    it('renders the error state instead of the empty state when loading fails', async () => {
      await createComponent();
      matchService.listRecent.mockRejectedValue(new Error('boom'));
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.tf-error')).toBeTruthy();
      expect(el.querySelector('.tf-empty')).toBeFalsy();
    });

    it('shows the rewind confirmation prompt, then confirms and removes the row', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match({ id: 'm1' })]);
      matchService.rewind.mockResolvedValue(undefined);
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const rewindButton = el.querySelector('.rewind button[mat-icon-button]') as HTMLButtonElement;
      expect(rewindButton).toBeTruthy();
      rewindButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('.confirm-prompt')).toBeTruthy();

      const confirmButton = Array.from(el.querySelectorAll('.rewind button')).find(b => b.textContent?.includes('Confirm') || b.getAttribute('color') === 'warn') as HTMLButtonElement;
      confirmButton.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('.row')).toBeFalsy();
    });

    it('cancelling the rewind confirmation hides the prompt again without calling rewind', async () => {
      await createComponent();
      matchService.listRecent.mockResolvedValue([match({ id: 'm1' })]);
      fixture = TestBed.createComponent(MatchHistoryComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();
      component.confirmingRewindId.set('m1');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const cancelButton = Array.from(el.querySelectorAll('.rewind button')).find(b => !b.hasAttribute('color')) as HTMLButtonElement;
      cancelButton.click();
      fixture.detectChanges();
      expect(component.confirmingRewindId()).toBeNull();
      expect(matchService.rewind).not.toHaveBeenCalled();
    });
  });
});
