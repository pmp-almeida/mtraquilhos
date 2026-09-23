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
});
