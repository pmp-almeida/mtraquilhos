import { TeamStatsService } from './team-stats.service';
import { MatchSummary } from '../core/models/match';
import { Player } from '../core/models/player';

const match = (id: string, teamA: [string, string], teamB: [string, string], winner: 'A' | 'B'): MatchSummary => ({
  id, playedAt: '', winner, scoreA: null, scoreB: null, seasonId: null,
  teamAPlayerIds: teamA, teamBPlayerIds: teamB, playerIds: [...teamA, ...teamB]
});

const player = (id: string, wins: number, losses: number): Player => ({
  id, displayName: id, elo: 520, peakElo: 520, placementMatches: 10, placementComplete: true,
  rank: { tier: 'Iron', division: 'I', rr: 50 }, demotionShield: false, demotionPending: false,
  wins, losses, isActive: true, createdAt: ''
});

describe('TeamStatsService', () => {
  const service = new TeamStatsService();

  it('aggregates a pair symmetrically no matter which side of the match they were on', () => {
    const matches = [
      match('1', ['a', 'b'], ['c', 'd'], 'A'),
      match('2', ['b', 'a'], ['c', 'd'], 'B')
    ];
    const pair = service.computePairs(matches).find(p => [p.playerLow, p.playerHigh].sort().join() === 'a,b');
    expect(pair?.matches).toBe(2);
    expect(pair?.wins).toBe(1);
    expect(pair?.losses).toBe(1);
  });

  it('excludes pairs below the minimum-matches-together threshold from Best Teams', () => {
    const pairs = service.computePairs([match('1', ['a', 'b'], ['c', 'd'], 'A')]);
    expect(service.bestTeams(pairs)).toEqual([]);
  });

  it('ranks Best Teams by win rate once the minimum is met', () => {
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 5; i++) matches.push(match(`m${i}`, ['a', 'b'], ['e', 'f'], 'A'));
    for (let i = 0; i < 5; i++) matches.push(match(`n${i}`, ['c', 'd'], ['e', 'f'], i < 2 ? 'A' : 'B'));
    const best = service.bestTeams(service.computePairs(matches), 5);
    expect([best[0].playerLow, best[0].playerHigh].sort()).toEqual(['a', 'b']);
    expect(best[0].winRate).toBe(1);
  });

  it('finds the pair that has played together the most, independent of win rate', () => {
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 3; i++) matches.push(match(`x${i}`, ['a', 'b'], ['c', 'd'], 'A'));
    for (let i = 0; i < 6; i++) matches.push(match(`y${i}`, ['e', 'f'], ['c', 'd'], 'B'));
    const duo = service.mostPlayedTogether(service.computePairs(matches));
    expect([duo?.playerLow, duo?.playerHigh].sort()).toEqual(['c', 'd']);
    expect(duo?.matches).toBe(9);
  });

  it('crowns "The One Who Carries" -- the player whose partners do better with them than without', () => {
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 5; i++) matches.push(match(`ab${i}`, ['a', 'b'], ['o1', 'o2'], 'A'));
    for (let i = 0; i < 5; i++) matches.push(match(`ac${i}`, ['a', 'c'], ['o3', 'o4'], 'A'));
    for (let i = 0; i < 5; i++) matches.push(match(`bx${i}`, ['b', 'x'], ['y', 'z'], 'B'));
    for (let i = 0; i < 5; i++) matches.push(match(`cw${i}`, ['c', 'w'], ['y', 'z'], 'B'));

    const players = [
      player('a', 10, 0),
      player('b', 5, 5),
      player('c', 5, 5),
      player('x', 0, 5),
      player('w', 0, 5),
      player('y', 10, 0),
      player('z', 10, 0)
    ];

    const carries = service.computeCarries(matches, players);
    const carry = carries.find(c => c.playerId === 'a');
    expect(carry?.liftRate).toBeCloseTo(1, 5);
    expect(carry?.partners).toBe(2);
    expect(service.theCarry(carries)?.playerId).toBe('a');
  });

  it('requires the "without" sample to meet its own minimum before counting a partner', () => {
    // a & b play together exactly 5 times (meets the pair minimum), but b
    // has no other recorded matches at all, so there's no reliable "without
    // a" baseline to compare against -- b shouldn't count toward a's score.
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 5; i++) matches.push(match(`ab${i}`, ['a', 'b'], ['o1', 'o2'], 'A'));
    const players = [player('a', 5, 0), player('b', 5, 0)];
    const carries = service.computeCarries(matches, players);
    expect(carries.find(c => c.playerId === 'a')).toBeUndefined();
  });
});
