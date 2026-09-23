import { TestBed } from '@angular/core/testing';
import { RankService } from './rank.service';
import { PLACEMENT_MATCHES_REQUIRED } from './rank.constants';

// Placement matches required was raised from 5 to 10 (spec addendum
// section 52) -- these tests drive `calculate()`'s second argument off the
// same constant `rank.service.ts` itself is built from, rather than a
// hardcoded magic number, so they can't silently drift out of sync again.
const PLACED = PLACEMENT_MATCHES_REQUIRED;

describe('RankService', () => {
  let service: RankService;
  beforeEach(() => { TestBed.configureTestingModule({}); service = TestBed.inject(RankService); });

  it('keeps players unranked until placements are complete', () => expect(service.calculate(520, PLACED - 1).tier).toBe('Unranked'));

  it('calculates the exact published boundaries', () => {
    expect(service.label(service.calculate(499, PLACED))).toBe('Lixo');
    expect(service.calculate(500, PLACED).rr).toBe(0);
    expect(service.calculate(520, PLACED).rr).toBe(50);
    expect(service.calculate(539, PLACED).rr).toBe(97);
    expect(service.label(service.calculate(540, PLACED))).toBe('Iron II');
    expect(service.label(service.calculate(1340, PLACED))).toBe('Champion');
  });

  describe('isAtDivisionFloor', () => {
    it('is true at 0 RR in a normal division', () => {
      expect(service.isAtDivisionFloor(service.calculate(500, PLACED))).toBe(true);
    });

    it('is false mid-division', () => {
      expect(service.isAtDivisionFloor(service.calculate(520, PLACED))).toBe(false);
    });

    it('is true for Champion, which has no RR to key off of', () => {
      expect(service.isAtDivisionFloor(service.calculate(1500, PLACED))).toBe(true);
    });

    it('is false for Lixo and Unranked, which have no lower rank to protect against', () => {
      expect(service.isAtDivisionFloor(service.calculate(400, PLACED))).toBe(false);
      expect(service.isAtDivisionFloor(service.calculate(520, 2))).toBe(false);
    });
  });
});
