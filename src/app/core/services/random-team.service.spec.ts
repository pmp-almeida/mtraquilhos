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

  describe('pickFairly', () => {
    it('returns every player, just reordered, when asked for the whole pool', () => {
      const players = ['1', '2', '3', '4'].map(id => player(id));
      const picked = new RandomTeamService().pickFairly(players, 4);
      expect(new Set(picked.map(p => p.id))).toEqual(new Set(['1', '2', '3', '4']));
    });

    it('returns fewer than requested if the pool is smaller', () => {
      const players = ['1', '2'].map(id => player(id));
      expect(new RandomTeamService().pickFairly(players, 4)).toHaveLength(2);
    });

    it('heavily favours whoever has played the least this session', () => {
      const service = new RandomTeamService();
      const rested = player('rested');
      const played = player('played');
      // 'played' has already started five matches tonight -- weight 1/6 -- vs 'rested' who hasn't played at all -- weight 1. 'rested' should come out on top in the vast majority of draws.
      service.recordPlayed(['played', 'played', 'played', 'played', 'played']);
      let restedFirst = 0;
      const iterations = 200;
      for (let i = 0; i < iterations; i++) {
        const [first] = service.pickFairly([rested, played], 1);
        if (first.id === 'rested') restedFirst += 1;
      }
      expect(restedFirst).toBeGreaterThan(iterations * 0.8);
    });

    it('gives a never-played pool uniform odds (no bias without recordPlayed)', () => {
      const service = new RandomTeamService();
      const players = ['1', '2', '3', '4'].map(id => player(id));
      const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 };
      const iterations = 400;
      for (let i = 0; i < iterations; i++) {
        const [first] = service.pickFairly(players, 1);
        counts[first.id] += 1;
      }
      for (const id of Object.keys(counts)) {
        expect(counts[id]).toBeGreaterThan(iterations * 0.1);
      }
    });
  });

  describe('recordPlayed', () => {
    it('accumulates across multiple calls for the same player', () => {
      const service = new RandomTeamService();
      service.recordPlayed(['a']);
      service.recordPlayed(['a', 'b']);
      const a = player('a');
      const b = player('b');
      let bFirst = 0;
      const iterations = 200;
      for (let i = 0; i < iterations; i++) {
        // 'a' played twice (weight 1/3), 'b' played once (weight 1/2) -- 'b' should still win more often, just not as overwhelmingly as the fresh-vs-veteran case above.
        const [first] = service.pickFairly([a, b], 1);
        if (first.id === 'b') bFirst += 1;
      }
      expect(bFirst).toBeGreaterThan(iterations * 0.5);
    });
  });
});
