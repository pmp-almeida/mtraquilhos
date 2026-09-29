import { HeadToHeadStatsService } from './head-to-head-stats.service';
import { MatchSummary } from '../core/models/match';

const match = (id: string, teamA: [string, string], teamB: [string, string], winner: 'A' | 'B'): MatchSummary => ({
  id, playedAt: '', winner, scoreA: null, scoreB: null, seasonId: null,
  teamAPlayerIds: teamA, teamBPlayerIds: teamB, playerIds: [...teamA, ...teamB]
});

describe('HeadToHeadStatsService', () => {
  const service = new HeadToHeadStatsService();

  it('counts both opponents from a 2v2 match, but not the teammate', () => {
    const stats = service.computeFromMatches('p1', [match('1', ['p1', 'p2'], ['p3', 'p4'], 'A')]);
    expect(stats.find(s => s.playerId === 'p3')?.matches).toBe(1);
    expect(stats.find(s => s.playerId === 'p4')?.matches).toBe(1);
    expect(stats.find(s => s.playerId === 'p2')).toBeUndefined();
  });

  it('requires the minimum sample before naming a matchup', () => {
    const stats = service.computeFromMatches('p1', [match('1', ['p1', 'p2'], ['p3', 'p4'], 'A')]);
    expect(service.bestMatchup(stats)).toBeNull();
    expect(service.worstMatchup(stats)).toBeNull();
  });

  it('picks the highest and lowest win-rate opponents once the minimum is met', () => {
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 5; i++) matches.push(match(`w${i}`, ['p1', 'p2'], ['rival', 'x'], 'A'));
    for (let i = 0; i < 5; i++) matches.push(match(`l${i}`, ['p1', 'p2'], ['nemesis', 'y'], 'B'));
    const stats = service.computeFromMatches('p1', matches);
    expect(service.bestMatchup(stats)?.playerId).toBe('rival');
    expect(service.worstMatchup(stats)?.playerId).toBe('nemesis');
  });

  it('ignores a match the player was not part of at all', () => {
    const stats = service.computeFromMatches('p1', [match('1', ['p2', 'p3'], ['p4', 'p5'], 'A')]);
    expect(stats).toEqual([]);
  });

  it('counts a win from the team-B side too, not just team A', () => {
    const stats = service.computeFromMatches('p1', [match('1', ['p3', 'p4'], ['p1', 'p2'], 'B')]);
    const opponent = stats.find(s => s.playerId === 'p3');
    expect(opponent?.wins).toBe(1);
    expect(opponent?.losses).toBe(0);
  });

  it('returns an empty stats array and null matchups for a player with no matches at all', () => {
    expect(service.computeFromMatches('p1', [])).toEqual([]);
    expect(service.bestMatchup([])).toBeNull();
    expect(service.worstMatchup([])).toBeNull();
  });

  it('breaks a win-rate tie by wins, then by playerId', () => {
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 3; i++) matches.push(match(`a${i}`, ['p1', 'p2'], ['beta', 'x'], 'A'));
    for (let i = 0; i < 2; i++) matches.push(match(`a${i + 3}`, ['p1', 'p2'], ['beta', 'x'], 'B'));
    for (let i = 0; i < 3; i++) matches.push(match(`c${i}`, ['p1', 'p2'], ['alpha', 'y'], 'A'));
    for (let i = 0; i < 2; i++) matches.push(match(`c${i + 3}`, ['p1', 'p2'], ['alpha', 'y'], 'B'));
    const stats = service.computeFromMatches('p1', matches);
    expect(service.bestMatchup(stats)?.playerId).toBe('alpha');
    expect(service.worstMatchup(stats)?.playerId).toBe('alpha');
  });
});
