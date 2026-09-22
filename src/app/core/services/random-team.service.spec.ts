import { RandomTeamService } from './random-team.service';
import { Player } from '../models/player';

const player = (id: string): Player => ({
  id, displayName: id, elo: 520, peakElo: 520, placementMatches: 0, placementComplete: false,
  rank: { tier: 'Unranked', division: null, rr: null }, demotionShield: false, demotionPending: false,
  wins: 0, losses: 0, isActive: true, createdAt: ''
});

describe('RandomTeamService', () => {
  it('rejects fewer than four players', () => {
    expect(() => new RandomTeamService().generate([player('1'), player('2'), player('3')])).toThrow();
  });

  it('returns four distinct players split into two teams', () => {
    const result = new RandomTeamService().generate(['1', '2', '3', '4', '5'].map(player));
    expect(result.teamA).toHaveLength(2);
    expect(result.teamB).toHaveLength(2);
    expect(new Set([...result.teamA, ...result.teamB].map(item => item.id)).size).toBe(4);
  });
});