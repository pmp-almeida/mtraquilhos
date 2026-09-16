import { TestBed } from '@angular/core/testing';
import { RankService } from './rank.service';

describe('RankService', () => {
  let service: RankService;
  beforeEach(() => { TestBed.configureTestingModule({}); service = TestBed.inject(RankService); });
  it('keeps players unranked until five placements', () => expect(service.calculate(520, 4).tier).toBe('Unranked'));
  it('calculates the exact published boundaries', () => {
    expect(service.label(service.calculate(499, 5))).toBe('Lixo');
    expect(service.calculate(500, 5).rr).toBe(0);
    expect(service.calculate(520, 5).rr).toBe(50);
    expect(service.calculate(539, 5).rr).toBe(97);
    expect(service.label(service.calculate(540, 5))).toBe('Iron II');
    expect(service.label(service.calculate(1340, 5))).toBe('Champion');
  });
});