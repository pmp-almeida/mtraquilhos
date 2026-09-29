import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TeamNamesComponent } from './team-names.component';
import { PlayerService } from '../../core/services/player.service';
import { TeamNameService } from '../../core/services/team-name.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { Player } from '../../core/models/player';
import { TeamName } from '../../core/models/team-name';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: `Player ${id}`, elo: 500, peakElo: 500, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: '', ...overrides
});

const FOUR = ['a1', 'a2', 'b1', 'b2'].map(id => player(id));

const teamName = (overrides: Partial<TeamName> = {}): TeamName => ({
  id: 'tn1', playerLow: 'a1', playerHigh: 'a2', name: 'Dream Team', createdAt: '', updatedAt: '', ...overrides
});

describe('TeamNamesComponent', () => {
  let fixture: ComponentFixture<TeamNamesComponent>;
  let component: TeamNamesComponent;
  let i18n: I18nService;
  let playerService: { listAll: ReturnType<typeof vi.fn>; nameMap: ReturnType<typeof vi.fn> };
  let teamNameService: { listAll: ReturnType<typeof vi.fn>; setName: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  let snackBarOpen: ReturnType<typeof vi.fn>;
  let historyStateSpy: ReturnType<typeof vi.spyOn> | null = null;

  async function createComponent(config: {
    players?: Player[]; teamNames?: TeamName[]; names?: Record<string, string>; rejectWith?: unknown;
  } = {}): Promise<void> {
    TestBed.resetTestingModule();
    playerService = {
      listAll: config.rejectWith ? vi.fn().mockRejectedValue(config.rejectWith) : vi.fn().mockResolvedValue(config.players ?? FOUR),
      nameMap: vi.fn().mockResolvedValue(config.names ?? {})
    };
    teamNameService = {
      listAll: vi.fn().mockResolvedValue(config.teamNames ?? []),
      setName: vi.fn(),
      clear: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TeamNamesComponent],
      providers: [
        { provide: PlayerService, useValue: playerService },
        { provide: TeamNameService, useValue: teamNameService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeamNamesComponent);
    component = fixture.componentInstance;
    i18n = TestBed.inject(I18nService);
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    historyStateSpy = null;
  });

  function setHistoryState(state: unknown): void {
    historyStateSpy = vi.spyOn(window.history, 'state', 'get').mockReturnValue(state);
  }

  describe('ngOnInit', () => {
    it('loads players, team names, and the name map', async () => {
      const names = [teamName()];
      await createComponent({ teamNames: names, names: { a1: 'Alice', a2: 'Amy' } });
      await component.ngOnInit();
      expect(component.players()).toEqual(FOUR);
      expect(component.teamNames()).toEqual(names);
      expect(component.error).toBe('');
    });

    it('sets an error message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
    });

    it('prefills the form from valid router state referencing two distinct known players', async () => {
      setHistoryState({ playerAId: 'a1', playerBId: 'a2' });
      await createComponent();
      await component.ngOnInit();
      expect(component.playerAId).toBe('a1');
      expect(component.playerBId).toBe('a2');
    });

    it('ignores router state when the two player ids are the same', async () => {
      setHistoryState({ playerAId: 'a1', playerBId: 'a1' });
      await createComponent();
      await component.ngOnInit();
      expect(component.playerAId).toBe('');
      expect(component.playerBId).toBe('');
    });

    it('ignores router state referencing an unknown player id', async () => {
      setHistoryState({ playerAId: 'ghost', playerBId: 'a2' });
      await createComponent();
      await component.ngOnInit();
      expect(component.playerAId).toBe('');
      expect(component.playerBId).toBe('');
    });

    it('ignores router state missing one of the two ids', async () => {
      setHistoryState({ playerAId: 'a1' });
      await createComponent();
      await component.ngOnInit();
      expect(component.playerAId).toBe('');
    });

    it('ignores a null router state', async () => {
      setHistoryState(null);
      await createComponent();
      await component.ngOnInit();
      expect(component.playerAId).toBe('');
      expect(component.playerBId).toBe('');
    });

    it('prefills the name input from an existing team name when prefilling from state', async () => {
      setHistoryState({ playerAId: 'a1', playerBId: 'a2' });
      await createComponent({ teamNames: [teamName({ playerLow: 'a1', playerHigh: 'a2', name: 'Dream Team' })] });
      await component.ngOnInit();
      expect(component.nameInput).toBe('Dream Team');
    });
  });

  describe('existingPairName', () => {
    it('returns null when either player is unselected', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = '';
      expect(component.existingPairName()).toBeNull();
    });

    it('returns null when both selected players are the same', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a1';
      expect(component.existingPairName()).toBeNull();
    });

    it('finds the existing name for the selected pair regardless of id order', async () => {
      await createComponent({ teamNames: [teamName({ playerLow: 'a1', playerHigh: 'a2' })] });
      await component.ngOnInit();
      component.playerAId = 'a2';
      component.playerBId = 'a1';
      expect(component.existingPairName()?.name).toBe('Dream Team');
    });

    it('returns null when the pair has no existing name', async () => {
      await createComponent();
      await component.ngOnInit();
      component.playerAId = 'a1';
      component.playerBId = 'b1';
      expect(component.existingPairName()).toBeNull();
    });
  });

  describe('onPairChanged', () => {
    it('prefills nameInput when the newly selected pair already has a name and the field is empty', async () => {
      await createComponent({ teamNames: [teamName({ playerLow: 'a1', playerHigh: 'a2', name: 'Dream Team' })] });
      await component.ngOnInit();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.onPairChanged();
      expect(component.nameInput).toBe('Dream Team');
    });

    it('does not overwrite a nameInput the user has already typed', async () => {
      await createComponent({ teamNames: [teamName({ playerLow: 'a1', playerHigh: 'a2', name: 'Dream Team' })] });
      await component.ngOnInit();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'My Custom Name';
      component.onPairChanged();
      expect(component.nameInput).toBe('My Custom Name');
    });
  });

  describe('canSave', () => {
    it('is false when a player is unselected', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = '';
      component.nameInput = 'Name';
      expect(component.canSave()).toBe(false);
    });

    it('is false when both players are the same', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a1';
      component.nameInput = 'Name';
      expect(component.canSave()).toBe(false);
    });

    it('is false when the name is blank or whitespace', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = '   ';
      expect(component.canSave()).toBe(false);
    });

    it('is true when two distinct players and a non-blank name are set', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'Name';
      expect(component.canSave()).toBe(true);
    });
  });

  describe('pairLabel / nameOf', () => {
    it('joins both players display names', async () => {
      await createComponent({ names: { a1: 'Alice', a2: 'Amy' } });
      await component.ngOnInit();
      expect(component.pairLabel('a1', 'a2')).toBe('Alice & Amy');
    });

    it('falls back to the unknown-player translation for an unmapped id', async () => {
      await createComponent({ names: {} });
      await component.ngOnInit();
      expect(component.nameOf('ghost')).toBe(i18n.t('common.unknownPlayer'));
    });
  });

  describe('clearForm / edit', () => {
    it('clearForm resets all three fields', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'x';
      component.clearForm();
      expect(component.playerAId).toBe('');
      expect(component.playerBId).toBe('');
      expect(component.nameInput).toBe('');
    });

    it('edit loads the team name into the form and cancels any pending delete confirmation', async () => {
      await createComponent();
      component.deletingId.set('tn1');
      component.edit(teamName({ playerLow: 'x1', playerHigh: 'x2', name: 'Foo' }));
      expect(component.playerAId).toBe('x1');
      expect(component.playerBId).toBe('x2');
      expect(component.nameInput).toBe('Foo');
      expect(component.deletingId()).toBeNull();
    });
  });

  describe('save', () => {
    it('shows a snackbar and does not call the service when the form is invalid', async () => {
      await createComponent();
      component.playerAId = 'a1';
      component.playerBId = 'a1';
      component.nameInput = 'x';
      await component.save();
      expect(teamNameService.setName).not.toHaveBeenCalled();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('is a no-op while already saving', async () => {
      await createComponent();
      component.saving.set(true);
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'x';
      await component.save();
      expect(teamNameService.setName).not.toHaveBeenCalled();
    });

    it('saves successfully, adds the new name to the list sorted by name, clears the form, and shows a success snackbar', async () => {
      await createComponent({ teamNames: [teamName({ id: 'existing', name: 'Zeta Squad', playerLow: 'b1', playerHigh: 'b2' })] });
      await component.ngOnInit();
      teamNameService.setName.mockResolvedValue(teamName({ id: 'new1', name: 'Alpha Duo', playerLow: 'a1', playerHigh: 'a2' }));
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'Alpha Duo';
      await component.save();
      expect(component.teamNames().map(tn => tn.name)).toEqual(['Alpha Duo', 'Zeta Squad']);
      expect(component.playerAId).toBe('');
      expect(component.saving()).toBe(false);
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('replaces an existing entry for the same pair when renaming', async () => {
      await createComponent({ teamNames: [teamName({ id: 'old', name: 'Old Name', playerLow: 'a1', playerHigh: 'a2' })] });
      await component.ngOnInit();
      teamNameService.setName.mockResolvedValue(teamName({ id: 'old', name: 'New Name', playerLow: 'a1', playerHigh: 'a2' }));
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'New Name';
      await component.save();
      expect(component.teamNames().length).toBe(1);
      expect(component.teamNames()[0].name).toBe('New Name');
    });

    it('shows an error snackbar with the error message when the service rejects with an Error', async () => {
      await createComponent();
      teamNameService.setName.mockRejectedValue(new Error('duplicate pair'));
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'x';
      await component.save();
      expect(snackBarOpen).toHaveBeenCalledWith('duplicate pair', expect.anything(), expect.anything());
      expect(component.saving()).toBe(false);
    });

    it('shows a generic error snackbar when the service rejects with a non-Error', async () => {
      await createComponent();
      teamNameService.setName.mockRejectedValue('nope');
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      component.nameInput = 'x';
      await component.save();
      expect(snackBarOpen).toHaveBeenCalledWith(i18n.t('teamNames.saveError'), expect.anything(), expect.anything());
    });
  });

  describe('remove', () => {
    it('removes the team name from the list, clears the confirm state, and shows a success snackbar', async () => {
      const tn = teamName({ id: 'tn1' });
      await createComponent({ teamNames: [tn] });
      await component.ngOnInit();
      component.deletingId.set('tn1');
      await component.remove(tn);
      expect(component.teamNames()).toEqual([]);
      expect(component.deletingId()).toBeNull();
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('shows an error snackbar with the error message when clear() rejects with an Error', async () => {
      const tn = teamName({ id: 'tn1' });
      await createComponent({ teamNames: [tn] });
      await component.ngOnInit();
      teamNameService.clear.mockRejectedValue(new Error('cannot delete'));
      await component.remove(tn);
      expect(snackBarOpen).toHaveBeenCalledWith('cannot delete', expect.anything(), expect.anything());
      expect(component.teamNames()).toEqual([tn]);
    });

    it('shows a generic error snackbar when clear() rejects with a non-Error', async () => {
      const tn = teamName({ id: 'tn1' });
      await createComponent({ teamNames: [tn] });
      await component.ngOnInit();
      teamNameService.clear.mockRejectedValue('nope');
      await component.remove(tn);
      expect(snackBarOpen).toHaveBeenCalledWith(i18n.t('teamNames.deleteError'), expect.anything(), expect.anything());
    });
  });

  describe('rendering', () => {
    it('renders the form, the existing-pair hint, and the list of team names', async () => {
      await createComponent({
        teamNames: [teamName({ playerLow: 'a1', playerHigh: 'a2', name: 'Dream Team' })],
        names: { a1: 'Alice', a2: 'Amy' }
      });
      await component.ngOnInit();
      component.playerAId = 'a1';
      component.playerBId = 'a2';
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Dream Team');
      expect(text).toContain('Alice');
    });

    it('renders the empty list state when there are no team names', async () => {
      await createComponent({ teamNames: [] });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(i18n.t('teamNames.empty'));
    });

    it('renders the error message when loading fails', async () => {
      await createComponent({ rejectWith: new Error('boom') });
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorEl = fixture.nativeElement.querySelector('.tf-error');
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain(i18n.t('teamNames.loadError'));
    });

    it('renders the delete-confirm row when a delete is pending for that team name', async () => {
      const tn = teamName({ id: 'tn1' });
      await createComponent({ teamNames: [tn] });
      await component.ngOnInit();
      component.deletingId.set('tn1');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.confirm-prompt')).toBeTruthy();
    });

    it('disables the save button while saving or when the form cannot be saved', async () => {
      await createComponent();
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const saveButton = fixture.nativeElement.querySelector('button[color="primary"]') as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });
  });
});
