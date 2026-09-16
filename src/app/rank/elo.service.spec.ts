import { TestBed } from '@angular/core/testing';
import { EloService } from './elo.service';

describe('EloService', () => {
  it('uses team averages and equal opposite deltas', () => {
    const service = TestBed.configureTestingModule({}).inject(EloService);
    const result = service.project([500, 540], [580, 620], 'A');
    expect(result.teamAElo).toBe(520);
    expect(result.teamBElo).toBe(600);
    expect(result.deltaA).toBe(-result.deltaB);
  });
});