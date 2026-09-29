import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SeasonsComponent } from './seasons.component';
import { SeasonService } from '../../core/services/season.service';
import { Season, StartSeasonResult } from '../../core/models/season';

const season = (overrides: Partial<Season> = {}): Season => ({
  id: 's1', seasonNumber: 1, name: 'Season One', startedAt: '2026-01-01T00:00:00Z',
  endedAt: null, isActive: false, compressionFactor: 0.5, ...overrides
});

describe('SeasonsComponent', () => {
  let fixture: ComponentFixture<SeasonsComponent>;
  let component: SeasonsComponent;
  let seasonService: { list: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> };
  let snackBarOpen: ReturnType<typeof vi.fn>;

  async function createComponent(): Promise<void> {
    TestBed.resetTestingModule();
    seasonService = { list: vi.fn().mockResolvedValue([]), start: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SeasonsComponent],
      providers: [{ provide: SeasonService, useValue: seasonService }]
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonsComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    snackBarOpen = vi.spyOn(MatSnackBar.prototype, 'open').mockImplementation(() => ({} as any));
  });

  afterEach(() => vi.restoreAllMocks());

  describe('loading', () => {
    it('loads seasons on init', async () => {
      await createComponent();
      const list = [season({ id: 'active', isActive: true }), season({ id: 'past', isActive: false })];
      seasonService.list.mockResolvedValue(list);
      await component.ngOnInit();
      expect(component.seasons()).toEqual(list);
    });

    it('sets an error message when loading fails', async () => {
      await createComponent();
      seasonService.list.mockRejectedValue(new Error('boom'));
      await component.ngOnInit();
      expect(component.error).toBeTruthy();
    });
  });

  describe('activeSeason / pastSeasons', () => {
    it('returns the active season and filters it out of the past list', async () => {
      await createComponent();
      const active = season({ id: 'active', isActive: true });
      const past = season({ id: 'past', isActive: false });
      seasonService.list.mockResolvedValue([active, past]);
      await component.ngOnInit();
      expect(component.activeSeason()).toEqual(active);
      expect(component.pastSeasons()).toEqual([past]);
    });

    it('returns null when there is no active season', async () => {
      await createComponent();
      seasonService.list.mockResolvedValue([season({ id: 'past', isActive: false })]);
      await component.ngOnInit();
      expect(component.activeSeason()).toBeNull();
    });
  });

  describe('canConfirm', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
    });

    it('is false when the name is empty or blank', () => {
      component.name = '';
      component.confirmName = '';
      expect(component.canConfirm()).toBe(false);
      component.name = '   ';
      component.confirmName = '   ';
      expect(component.canConfirm()).toBe(false);
    });

    it('is false when the confirmation does not match the name', () => {
      component.name = 'Season Two';
      component.confirmName = 'Season Twoo';
      expect(component.canConfirm()).toBe(false);
    });

    it('is true when the trimmed confirmation matches the trimmed name', () => {
      component.name = '  Season Two  ';
      component.confirmName = 'Season Two';
      expect(component.canConfirm()).toBe(true);
    });
  });

  describe('startSeason', () => {
    beforeEach(async () => {
      await createComponent();
      await component.ngOnInit();
      component.name = 'Season Two';
      component.confirmName = 'Season Two';
    });

    it('does nothing when canConfirm() is false', async () => {
      component.confirmName = 'mismatch';
      await component.startSeason();
      expect(seasonService.start).not.toHaveBeenCalled();
    });

    it('is a no-op while already saving', async () => {
      let resolveStart!: (value: StartSeasonResult) => void;
      seasonService.start.mockReturnValue(new Promise(resolve => { resolveStart = resolve; }));
      const first = component.startSeason();
      const second = component.startSeason();
      resolveStart({ seasonId: 's2', seasonNumber: 2, name: 'Season Two', compressionFactor: 0.5, meanElo: 520, playersCompressed: 3 });
      await Promise.all([first, second]);
      expect(seasonService.start).toHaveBeenCalledTimes(1);
    });

    it('clamps the compression percent into 0-100 before converting to a 0-1 factor', async () => {
      component.compressionPercent = 250;
      seasonService.start.mockResolvedValue({ seasonId: 's2', seasonNumber: 2, name: 'Season Two', compressionFactor: 1, meanElo: 520, playersCompressed: 0 });
      await component.startSeason();
      expect(seasonService.start).toHaveBeenCalledWith('Season Two', 1);
    });

    it('clamps a negative compression percent up to 0', async () => {
      component.compressionPercent = -40;
      seasonService.start.mockResolvedValue({ seasonId: 's2', seasonNumber: 2, name: 'Season Two', compressionFactor: 0, meanElo: 520, playersCompressed: 0 });
      await component.startSeason();
      expect(seasonService.start).toHaveBeenCalledWith('Season Two', 0);
    });

    it('on success: shows a toast, closes the form, resets fields, and refreshes', async () => {
      component.starting.set(true);
      component.compressionPercent = 70;
      seasonService.start.mockResolvedValue({ seasonId: 's2', seasonNumber: 2, name: 'Season Two', compressionFactor: 0.7, meanElo: 520, playersCompressed: 5 });
      seasonService.list.mockClear();
      await component.startSeason();
      expect(snackBarOpen).toHaveBeenCalled();
      expect(component.starting()).toBe(false);
      expect(component.name).toBe('');
      expect(component.confirmName).toBe('');
      expect(component.compressionPercent).toBe(50);
      expect(seasonService.list).toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });

    it('on failure: shows the error message in a toast and keeps saving false', async () => {
      seasonService.start.mockRejectedValue(new Error('name already used'));
      await component.startSeason();
      expect(snackBarOpen).toHaveBeenCalledWith('name already used', expect.anything(), expect.anything());
      expect(component.saving()).toBe(false);
    });

    it('falls back to a generic error message when the rejection is not an Error', async () => {
      seasonService.start.mockRejectedValue('nope');
      await component.startSeason();
      expect(snackBarOpen).toHaveBeenCalled();
      const message = snackBarOpen.mock.calls[0][0];
      expect(typeof message).toBe('string');
      expect(message).not.toBe('nope');
    });
  });

  describe('rendering', () => {
    it('renders the active season card, history rows, and toggles the start-season form', async () => {
      await createComponent();
      seasonService.list.mockResolvedValue([
        season({ id: 'active', isActive: true, seasonNumber: 2, name: 'Season Two' }),
        season({ id: 'past', isActive: false, seasonNumber: 1, name: 'Season One', endedAt: '2026-02-01T00:00:00Z' })
      ]);
      fixture = TestBed.createComponent(SeasonsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.active-card')).toBeTruthy();
      expect(el.querySelector('.history-row')).toBeTruthy();
      expect(el.textContent).toContain('Season Two');
      expect(el.textContent).toContain('Season One');

      // Toggle into the start-new-season form.
      const startButton = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Start'));
      startButton?.dispatchEvent(new Event('click'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el.querySelector('.start-card')).toBeTruthy();
    });

    it('renders the empty-history message and no active-season card when there are no seasons', async () => {
      await createComponent();
      seasonService.list.mockResolvedValue([]);
      fixture = TestBed.createComponent(SeasonsComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.active-card')).toBeFalsy();
      expect(el.querySelector('.tf-empty')).toBeTruthy();
    });

    it('renders the load-error message', async () => {
      await createComponent();
      seasonService.list.mockRejectedValue(new Error('boom'));
      fixture = TestBed.createComponent(SeasonsComponent);
      component = fixture.componentInstance;
      await component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.tf-error')).toBeTruthy();
    });
  });
});
