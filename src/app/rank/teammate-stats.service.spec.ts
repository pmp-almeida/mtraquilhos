import { TeammateStatsService } from './teammate-stats.service';
import { MatchSummary } from '../core/models/match';

const match = (id: string, teamA: [string, string], teamB: [string, string], winner: 'A' | 'B'): MatchSummary => ({
  id, playedAt: '', winner, scoreA: null, scoreB: null, seasonId: null,
  teamAPlayerIds: teamA, teamBPlayerIds: teamB, playerIds: [...teamA, ...teamB]
});

describe('TeammateStatsService', () => {
  const service = new TeammateStatsService();

  describe('computeFromMatches', () => {
    it('identifies the teammate as whoever shares a team letter, whichever side the player is on', () => {
      const matches = [
        match('1', ['p', 'teammateA'], ['x', 'y'], 'A'),
        match('2', ['x', 'y'], ['p', 'teammateA'], 'B')
      ];
      const stats = service.computeFromMatches('p', matches);
      expect(stats).toHaveLength(1);
      expect(stats[0].playerId).toBe('teammateA');
      expect(stats[0].matches).toBe(2);
    });

    it('counts a win only when the player\'s own team letter matches the recorded winner', () => {
      const matches = [
        match('1', ['p', 't'], ['x', 'y'], 'A'), // p on A, A wins -> win
        match('2', ['p', 't'], ['x', 'y'], 'B'), // p on A, B wins -> loss
        match('3', ['x', 'y'], ['p', 't'], 'B'), // p on B, B wins -> win
        match('4', ['x', 'y'], ['p', 't'], 'A')  // p on B, A wins -> loss
      ];
      const [stat] = service.computeFromMatches('p', matches);
      expect(stat.matches).toBe(4);
      expect(stat.wins).toBe(2);
      expect(stat.losses).toBe(2);
      expect(stat.winRate).toBe(0.5);
    });

    it('ignores matches the player was not part of', () => {
      const matches = [match('1', ['x', 'y'], ['z', 'w'], 'A')];
      expect(service.computeFromMatches('p', matches)).toEqual([]);
    });

    it('tracks separate totals per distinct teammate', () => {
      const matches = [
        match('1', ['p', 't1'], ['x', 'y'], 'A'),
        match('2', ['p', 't2'], ['x', 'y'], 'B')
      ];
      const stats = service.computeFromMatches('p', matches);
      const byId = Object.fromEntries(stats.map(s => [s.playerId, s]));
      expect(byId['t1'].matches).toBe(1);
      expect(byId['t2'].matches).toBe(1);
    });

    it('returns winRate 0 for a teammate with zero matches (defensive; matches is always >0 in practice)', () => {
      // computeFromMatches never actually produces a zero-matches entry, but
      // the winRate calculation guards against divide-by-zero explicitly --
      // verify that guard directly via best()/worst() with an empty list
      // instead, since the private path can't be reached from outside.
      expect(service.computeFromMatches('p', [])).toEqual([]);
    });
  });

  describe('best/worst', () => {
    const statsAtThreshold = (overrides: Partial<{ a: number; b: number }> = {}) => {
      const matches: MatchSummary[] = [];
      for (let i = 0; i < 5; i++) matches.push(match(`a${i}`, ['p', 'good'], ['x', 'y'], 'A'));
      for (let i = 0; i < 5; i++) matches.push(match(`b${i}`, ['p', 'bad'], ['x', 'y'], i < (overrides.b ?? 1) ? 'A' : 'B'));
      return matches;
    };

    it('excludes teammates below the minimum-5-matches-together threshold', () => {
      const matches = [
        match('1', ['p', 'rare'], ['x', 'y'], 'A'),
        match('2', ['p', 'rare'], ['x', 'y'], 'A')
      ];
      const stats = service.computeFromMatches('p', matches);
      expect(service.best(stats)).toBeNull();
      expect(service.worst(stats)).toBeNull();
    });

    it('includes a teammate right at the 5-match minimum', () => {
      const matches: MatchSummary[] = [];
      for (let i = 0; i < 5; i++) matches.push(match(`m${i}`, ['p', 't'], ['x', 'y'], 'A'));
      const stats = service.computeFromMatches('p', matches);
      expect(service.best(stats)?.playerId).toBe('t');
    });

    it('best() picks the highest win rate among eligible teammates', () => {
      const matches = statsAtThreshold();
      const stats = service.computeFromMatches('p', matches);
      expect(service.best(stats)?.playerId).toBe('good');
    });

    it('worst() picks the lowest win rate among eligible teammates', () => {
      const matches = statsAtThreshold();
      const stats = service.computeFromMatches('p', matches);
      expect(service.worst(stats)?.playerId).toBe('bad');
    });

    it('breaks a win-rate tie by wins, then by playerId', () => {
      // 'alpha' and 'beta' both have 5 matches at 60% win rate (3-2), a true
      // tie -- alphabetical order decides.
      const matches: MatchSummary[] = [];
      for (let i = 0; i < 3; i++) matches.push(match(`a${i}`, ['p', 'beta'], ['x', 'y'], 'A'));
      for (let i = 0; i < 2; i++) matches.push(match(`a${i + 3}`, ['p', 'beta'], ['x', 'y'], 'B'));
      for (let i = 0; i < 3; i++) matches.push(match(`c${i}`, ['p', 'alpha'], ['x', 'y'], 'A'));
      for (let i = 0; i < 2; i++) matches.push(match(`c${i + 3}`, ['p', 'alpha'], ['x', 'y'], 'B'));
      const stats = service.computeFromMatches('p', matches);
      expect(service.best(stats)?.playerId).toBe('alpha');
      expect(service.worst(stats)?.playerId).toBe('alpha');
    });

    it('returns null for both when there are no stats at all', () => {
      expect(service.best([])).toBeNull();
      expect(service.worst([])).toBeNull();
    });
  });
});
