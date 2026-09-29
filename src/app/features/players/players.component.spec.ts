import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlayersComponent } from './players.component';
import { PlayerService } from '../../core/services/player.service';
import { Player } from '../../core/models/player';

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id, displayName: id, elo: 520, peakElo: 520, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: '', ...overrides
});

describe('PlayersComponent', () => {
  let fixture: ComponentFixture<PlayersComponent>;
  let component: PlayersComponent;
  let playerService: { listAll: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn> };
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(players: Player[] = []): Promise<void> {
    TestBed.resetTestingModule();
    playerService = {
      listAll: vi.fn().mockResolvedValue(players),
      create: vi.fn(),
      setActive: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [PlayersComponent],
      providers: [{ provide: PlayerService, useValue: playerService }, provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayersComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows a creation error instead of failing silently', async () => {
    await createComponent();
    playerService.create.mockRejectedValue(new Error('Player could not be created.'));
    await component.ngOnInit();
    component.newName = 'Alice';

    await component.create();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Player could not be created.');
  });

  describe('ngOnInit', () => {
    it('loads every player, active and inactive', async () => {
      await createComponent([player('a1'), player('a2', { isActive: false })]);
      await component.ngOnInit();
      expect(component.players()).toHaveLength(2);
    });

    it('sets a load error when listAll rejects', async () => {
      await createComponent();
      playerService.listAll.mockRejectedValue(new Error('offline'));
      await component.ngOnInit();
      expect(component.error).not.toBe('');
      expect(component.players()).toEqual([]);
    });
  });

  describe('activePlayers / inactivePlayers', () => {
    it('splits players by isActive', async () => {
      await createComponent([player('a1'), player('a2', { isActive: false }), player('a3')]);
      await component.ngOnInit();
      expect(component.activePlayers().map(p => p.id)).toEqual(['a1', 'a3']);
      expect(component.inactivePlayers().map(p => p.id)).toEqual(['a2']);
    });
  });

  describe('create', () => {
    it('trims the name, appends the created player, and clears the input on success', async () => {
      await createComponent([player('existing', { elo: 100 })]);
      await component.ngOnInit();
      playerService.create.mockResolvedValue(player('new1', { elo: 999 }));
      component.newName = '  New1  ';

      await component.create();

      expect(playerService.create).toHaveBeenCalledWith('  New1  ');
      expect(component.newName).toBe('');
      expect(component.error).toBe('');
      // New active players sort ahead of existing ones by elo (active first, then elo desc).
      expect(component.players()[0].id).toBe('new1');
    });

    it('falls back to a generic error message for a non-Error rejection', async () => {
      await createComponent();
      await component.ngOnInit();
      playerService.create.mockRejectedValue('nope');
      component.newName = 'X';
      await component.create();
      expect(component.error).not.toBe('');
    });

    it('clears any previous error at the start of a new attempt', async () => {
      await createComponent();
      await component.ngOnInit();
      playerService.create.mockRejectedValueOnce(new Error('first failure'));
      component.newName = 'X';
      await component.create();
      expect(component.error).toBe('first failure');

      playerService.create.mockResolvedValueOnce(player('x'));
      component.newName = 'Y';
      await component.create();
      expect(component.error).toBe('');
    });
  });

  describe('toggleActive', () => {
    it('flips a player active -> inactive, shows a success snackbar', async () => {
      await createComponent([player('a1')]);
      await component.ngOnInit();
      await component.toggleActive(component.players()[0]);
      expect(playerService.setActive).toHaveBeenCalledWith('a1', false);
      expect(component.players()[0].isActive).toBe(false);
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.togglingId()).toBeNull();
    });

    it('flips a player inactive -> active', async () => {
      await createComponent([player('a1', { isActive: false })]);
      await component.ngOnInit();
      await component.toggleActive(component.players()[0]);
      expect(playerService.setActive).toHaveBeenCalledWith('a1', true);
      expect(component.players()[0].isActive).toBe(true);
    });

    it('shows an error snackbar and still resets togglingId when the update fails', async () => {
      await createComponent([player('a1')]);
      await component.ngOnInit();
      playerService.setActive.mockRejectedValue(new Error('offline'));
      await component.toggleActive(component.players()[0]);
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.togglingId()).toBeNull();
    });

    it('falls back to a generic error message for a non-Error rejection', async () => {
      await createComponent([player('a1')]);
      await component.ngOnInit();
      playerService.setActive.mockRejectedValue('nope');
      await component.toggleActive(component.players()[0]);
      expect(snackBarOpen).toHaveBeenCalled();
    });

    it('ignores a second toggle while one is already in flight', async () => {
      await createComponent([player('a1'), player('a2')]);
      await component.ngOnInit();
      component.togglingId.set('a1');
      await component.toggleActive(component.players()[1]);
      expect(playerService.setActive).not.toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('shows the empty state with no players at all', async () => {
      await createComponent([]);
      await component.ngOnInit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty')).toBeTruthy();
    });

    it('renders active and inactive sections with their players', async () => {
      await createComponent([player('a1'), player('a2', { isActive: false })]);
      await component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.player').length).toBe(2);
      expect(el.querySelector('.section-title')).toBeTruthy();
    });

    it('disables the add-player button until a name is entered', async () => {
      await createComponent([]);
      await component.ngOnInit();
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button[color="primary"]') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = 'Someone';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
    });
  });
});
