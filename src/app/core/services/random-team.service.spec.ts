import { RandomTeamService } from './random-team.service';
import { Player } from '../models/player';

const player = (id: string, elo = 520): Player => ({
  id, displayName: id, elo, peakElo: elo, placementMatches: 0, placementComplete: false,
  rank: { tier: 'Unranked', division: null, rr: null }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: ''
});

describe('RandomTeamService', () => {
  it('rejects fewer than four players', () => {
    expect(() => new RandomTeamService().generate([player('1'), player('2'), player('3')])).toThrow();
  });

  it('returns four distinct players split into two teams', () => {
    const result = new RandomTeamService().generate(['1', '2', '3', '4', '5'].map(id => player(id)));
    expect(result.teamA).toHaveLength(2);
    expect(result.teamB).toHaveLength(2);
    expect(new Set([...result.teamA, ...result.teamB].map(item => item.id)).size).toBe(4);
  });

  it('balanced mode picks the split with the smallest Elo gap between teams', () => {
    // Four players whose only close-to-even split is the strongest with the
    // weakest on each side (500+900=1400 vs 700+700=1400) -- any other
    // pairing is lopsided by comparison.
    const players = [player('weak', 500), player('mid1', 700), player('mid2', 700), player('strong', 900)];
    const result = new RandomTeamService().generate(players, 'balanced');
    const ids = (team: Player[]) => team.map(p => p.id).sort();
    const sides = [ids(result.teamA), ids(result.teamB)].sort();
    expect(sides).toEqual([['mid1', 'mid2'], ['strong', 'weak']]);
  });

  it('balanced mode still returns four distinct players', () => {
    const players = ['1', '2', '3', '4', '5', '6'].map((id, i) => player(id, 500 + i * 30));
    const result = new RandomTeamService().generate(players, 'balanced');
    expect(new Set([...result.teamA, ...result.teamB].map(item => item.id)).size).toBe(4);
  });
});
