import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HowItWorksComponent } from './how-it-works.component';
import { RankService } from '../../rank/rank.service';
import { EloService } from '../../rank/elo.service';
import {
  CHAMPION_FLOOR,
  DIVISION_WIDTH,
  K_FACTOR,
  PLACEMENT_MATCHES_REQUIRED,
  RANK_THRESHOLDS,
  STARTING_ELO
} from '../../rank/rank.constants';

describe('HowItWorksComponent', () => {
  let fixture: ComponentFixture<HowItWorksComponent>;
  let component: HowItWorksComponent;
  let rankService: RankService;
  let eloService: EloService;

  beforeEach(async () => {
    rankService = new RankService();
    eloService = new EloService();

    await TestBed.configureTestingModule({
      imports: [HowItWorksComponent],
      providers: [
        provideRouter([]),
        { provide: RankService, useValue: rankService },
        { provide: EloService, useValue: eloService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HowItWorksComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the real constants rather than hardcoded copies', () => {
    expect(component.startingElo).toBe(STARTING_ELO);
    expect(component.kFactor).toBe(K_FACTOR);
    expect(component.placementMatchesRequired).toBe(PLACEMENT_MATCHES_REQUIRED);
    expect(component.divisionWidth).toBe(DIVISION_WIDTH);
    expect(component.championFloor).toBe(CHAMPION_FLOOR);
  });

  describe('tierTable', () => {
    it('has exactly one row for Lixo, one per RANK_THRESHOLDS entry, and one for Champion', () => {
      expect(component.tierTable).toHaveLength(RANK_THRESHOLDS.length + 2);
      expect(component.tierTable[0].state.tier).toBe('Lixo');
      expect(component.tierTable[0].floorLabel).toBe('0');
      expect(component.tierTable[component.tierTable.length - 1].state.tier).toBe('Champion');
      expect(component.tierTable[component.tierTable.length - 1].floorLabel).toBe(`${CHAMPION_FLOOR}`);
    });

    it('mirrors every threshold\'s tier, division, and floor from rank.constants exactly', () => {
      RANK_THRESHOLDS.forEach((threshold, i) => {
        const row = component.tierTable[i + 1]; // offset by the leading Lixo row
        expect(row.state.tier).toBe(threshold.tier);
        expect(row.state.division).toBe(threshold.division);
        expect(row.floorLabel).toBe(`${threshold.floor}`);
      });
    });

    it('sets each row\'s ceiling to one less than the next threshold\'s floor (or CHAMPION_FLOOR - 1 for the last one)', () => {
      RANK_THRESHOLDS.forEach((threshold, i) => {
        const row = component.tierTable[i + 1];
        const next = RANK_THRESHOLDS[i + 1];
        const expectedCeiling = next ? next.floor - 1 : CHAMPION_FLOOR - 1;
        expect(row.ceilingLabel).toBe(`${expectedCeiling}`);
      });
    });
  });

  describe('placementExamples / rrExamples', () => {
    it('computes each placement example through the real RankService, matching calculate() directly', () => {
      for (const row of component.placementExamples) {
        expect(row.state).toEqual(rankService.calculate(row.elo, PLACEMENT_MATCHES_REQUIRED));
      }
    });

    it('computes each RR example through the real RankService, matching calculate() directly', () => {
      for (const row of component.rrExamples) {
        expect(row.state).toEqual(rankService.calculate(row.elo, PLACEMENT_MATCHES_REQUIRED));
      }
    });
  });

  describe('eloExample / eloExampleTeamsHtml', () => {
    it('projects the worked example through the real EloService', () => {
      const expected = eloService.project([500, 540], [580, 620], 'A');
      expect(component.eloExample()).toEqual(expected);
    });

    it('renders the two team lines as a <br />-joined HTML string, not a literal \\n', () => {
      const html = component.eloExampleTeamsHtml();
      expect(html).toContain('<br />');
      expect(html).not.toContain('\\n');
      expect(html).toContain(String(component.eloExample().teamAElo));
      expect(html).toContain(String(component.eloExample().teamBElo));
    });
  });

  describe('jumpTo', () => {
    it('scrolls the target section into view and pushes a fragment URL on a plain left click', () => {
      const el = { scrollIntoView: vi.fn() };
      const getByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(el as unknown as HTMLElement);
      const pushStateSpy = vi.spyOn(history, 'pushState').mockImplementation(() => {});
      const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() } as unknown as MouseEvent;

      component.jumpTo(event, 'elo');

      expect(event.preventDefault).toHaveBeenCalled();
      expect(getByIdSpy).toHaveBeenCalledWith('elo');
      expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(pushStateSpy).toHaveBeenCalledWith(null, '', expect.stringContaining('#elo'));
    });

    it('does nothing (lets the browser handle it) for a modified click, e.g. ctrl+click to open in a new tab', () => {
      const getByIdSpy = vi.spyOn(document, 'getElementById');
      const event = { button: 0, metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, preventDefault: vi.fn() } as unknown as MouseEvent;

      component.jumpTo(event, 'elo');

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(getByIdSpy).not.toHaveBeenCalled();
    });

    it('does nothing for a non-primary mouse button (e.g. middle-click)', () => {
      const event = { button: 1, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() } as unknown as MouseEvent;
      component.jumpTo(event, 'elo');
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('is a no-op (but does not throw) when the target section is missing from the DOM', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      vi.spyOn(history, 'pushState').mockImplementation(() => {});
      const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: vi.fn() } as unknown as MouseEvent;
      expect(() => component.jumpTo(event, 'ghost')).not.toThrow();
    });
  });

  describe('rendering', () => {
    it('renders every jump-linked section and its heading, plus all eight jump links', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      for (const id of ['elo', 'placements', 'tiers', 'rr', 'rankups', 'shield', 'special', 'glossary']) {
        expect(el.querySelector(`#${id}`)).toBeTruthy();
      }
      expect(el.querySelectorAll('.jump-links a')).toHaveLength(8);
    });

    it('renders one tier-row per tierTable entry and one placement-row per placementExamples entry', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.tier-row')).toHaveLength(component.tierTable.length);
      expect(el.querySelectorAll('.placement-row')).toHaveLength(component.placementExamples.length);
      expect(el.querySelectorAll('.rr-row')).toHaveLength(component.rrExamples.length);
    });

    it('renders the worked Elo example paragraph via innerHTML with a line break', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const exampleParagraphs = el.querySelectorAll('.example p');
      expect(exampleParagraphs.length).toBeGreaterThan(0);
      expect(exampleParagraphs[0].querySelector('br')).toBeTruthy();
    });

    it('renders the full glossary list', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.glossary .term').length).toBeGreaterThan(5);
    });
  });
});
