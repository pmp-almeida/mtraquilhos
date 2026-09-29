import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MatchService } from './match.service';
import { SupabaseService } from './supabase.service';

/** Minimal chainable stand-in for a Supabase PostgREST query builder. Every
 *  chain method returns itself; awaiting the builder at any point resolves
 *  to the canned { data, error } result, since it implements `then`. Also
 *  records every call made on it, keyed by method name, for assertions. */
function queryStub(result: { data?: any; error?: any; count?: any }, calls: Record<string, any[][]> = {}) {
  return new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
      }
      return (...args: any[]) => {
        (calls[prop] ??= []).push(args);
        return queryStub(result, calls);
      };
    }
  }) as any;
}

function makeService(client: any): MatchService {
  TestBed.configureTestingModule({
    providers: [MatchService, { provide: SupabaseService, useValue: { client } }]
  });
  return TestBed.inject(MatchService);
}

describe('MatchService', () => {
  describe('with no configured client', () => {
    const service = makeService(null);

    it('record() throws', async () => {
      await expect(service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A'
      })).rejects.toThrow('Supabase is not configured');
    });

    it('rewind() throws', async () => {
      await expect(service.rewind('m1')).rejects.toThrow('Supabase is not configured');
    });

    it('listRecent() returns []', async () => {
      expect(await service.listRecent()).toEqual([]);
    });

    it('listAll() returns []', async () => {
      expect(await service.listAll()).toEqual([]);
    });

    it('listForPlayer() returns []', async () => {
      expect(await service.listForPlayer('p1')).toEqual([]);
    });

    it('listRatingEvents() returns []', async () => {
      expect(await service.listRatingEvents('p1')).toEqual([]);
    });

    it('countAll() returns 0', async () => {
      expect(await service.countAll()).toBe(0);
    });
  });

  describe('record()', () => {
    it('sends the RPC with all expected params, using the current time when playedAt is omitted', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: {
          matchId: 'm1', seasonId: 's1', expectedProbability: 0.5,
          teamAElo: 1000, teamBElo: 1010, teamDelta: 12,
          players: []
        },
        error: null
      });
      const service = makeService({ rpc });

      const before = Date.now();
      await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd',
        winner: 'B', scoreA: 5, scoreB: 10, note: 'friendly'
      });
      const after = Date.now();

      expect(rpc).toHaveBeenCalledTimes(1);
      const [name, args] = rpc.mock.calls[0];
      expect(name).toBe('record_match');
      expect(args.p_team_a_player_1).toBe('a');
      expect(args.p_team_a_player_2).toBe('b');
      expect(args.p_team_b_player_1).toBe('c');
      expect(args.p_team_b_player_2).toBe('d');
      expect(args.p_winner).toBe('B');
      expect(args.p_score_a).toBe(5);
      expect(args.p_score_b).toBe(10);
      expect(args.p_note).toBe('friendly');
      expect(new Date(args.p_played_at).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(args.p_played_at).getTime()).toBeLessThanOrEqual(after);
    });

    it('defaults optional scoreA/scoreB/note/playedAt to null when omitted, except playedAt which defaults to now', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { matchId: 'm1', players: [] },
        error: null
      });
      const service = makeService({ rpc });
      await service.record({ teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A' });
      const [, args] = rpc.mock.calls[0];
      expect(args.p_score_a).toBeNull();
      expect(args.p_score_b).toBeNull();
      expect(args.p_note).toBeNull();
      expect(typeof args.p_played_at).toBe('string');
    });

    it('passes playedAt through unchanged when provided', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: { matchId: 'm1', players: [] }, error: null });
      const service = makeService({ rpc });
      await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd',
        winner: 'A', playedAt: '2026-01-01T00:00:00.000Z'
      });
      expect(rpc.mock.calls[0][1].p_played_at).toBe('2026-01-01T00:00:00.000Z');
    });

    it('rejects when the RPC returns an error', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
      const service = makeService({ rpc });
      await expect(service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A'
      })).rejects.toThrow('boom');
    });

    it('maps the players array from snake_case RPC rows', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: {
          matchId: 'm1', seasonId: null, expectedProbability: 0.6, teamAElo: 1000, teamBElo: 990, teamDelta: 8,
          players: [{
            player_id: 'a', elo_before: 1000, elo_after: 1008, elo_delta: 8,
            rank_before: 'Iron I', rank_after: 'Iron II', rr_before: 40, rr_after: 60,
            placement_matches_before: 5, placement_matches_after: 6,
            demotion_shield_before: false, demotion_shield_after: true
          }]
        },
        error: null
      });
      const service = makeService({ rpc });
      const result = await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A'
      });
      expect(result.players).toEqual([{
        playerId: 'a', eloBefore: 1000, eloAfter: 1008, eloDelta: 8,
        rankBefore: 'Iron I', rankAfter: 'Iron II', rrBefore: 40, rrAfter: 60,
        placementMatchesBefore: 5, placementMatchesAfter: 6,
        demotionShieldBefore: false, demotionShieldAfter: true
      }]);
    });

    it('defaults players to [] and seasonId to null when absent from the RPC response', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: { matchId: 'm1' }, error: null });
      const service = makeService({ rpc });
      const result = await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A'
      });
      expect(result.players).toEqual([]);
      expect(result.seasonId).toBeNull();
    });

    it('echoes input.winner regardless of teamDelta sign -- winner is never derived from teamDelta', async () => {
      // teamDelta is a magnitude (always >= 0 per the model's contract), but
      // even if a future regression made the RPC return something
      // sign-like, `winner` must still be exactly what was requested.
      const rpc = vi.fn().mockResolvedValue({
        data: { matchId: 'm1', teamAElo: 1000, teamBElo: 1000, teamDelta: 25, players: [] },
        error: null
      });
      const service = makeService({ rpc });

      const resultB = await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'B'
      });
      expect(resultB.winner).toBe('B');
      expect(resultB.teamDelta).toBe(25);

      const resultA = await service.record({
        teamAPlayer1: 'a', teamAPlayer2: 'b', teamBPlayer1: 'c', teamBPlayer2: 'd', winner: 'A'
      });
      expect(resultA.winner).toBe('A');
      // Same positive teamDelta magnitude either way -- a sign-based
      // heuristic would have gotten one of these two cases wrong.
      expect(resultA.teamDelta).toBe(25);
    });
  });

  describe('rewind()', () => {
    it('sends the matchId to the RPC', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
      const service = makeService({ rpc });
      await service.rewind('match-123');
      expect(rpc).toHaveBeenCalledWith('rewind_match', { p_match_id: 'match-123' });
    });

    it('rejects with the RPC error message', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('not the most recent match') });
      const service = makeService({ rpc });
      await expect(service.rewind('match-123')).rejects.toThrow('not the most recent match');
    });
  });

  const rawMatchRow = {
    id: 'm1', played_at: '2026-01-01', winner: 'A', score_a: 10, score_b: 5, season_id: 's1',
    team_a_player_1: 'a', team_a_player_2: 'b', team_b_player_1: 'c', team_b_player_2: 'd'
  };
  const mappedMatch = {
    id: 'm1', playedAt: '2026-01-01', winner: 'A', scoreA: 10, scoreB: 5, seasonId: 's1',
    teamAPlayerIds: ['a', 'b'], teamBPlayerIds: ['c', 'd'], playerIds: ['a', 'b', 'c', 'd']
  };

  describe('listRecent()', () => {
    it('maps rows and defaults the limit to 20', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawMatchRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listRecent();
      expect(from).toHaveBeenCalledWith('matches');
      expect(calls['limit'][0]).toEqual([20]);
      expect(calls['order'][0]).toEqual(['played_at', { ascending: false }]);
      expect(result).toEqual([mappedMatch]);
    });

    it('passes a custom limit through', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [], error: null }, calls));
      const service = makeService({ from });
      await service.listRecent(5);
      expect(calls['limit'][0]).toEqual([5]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('db down') }));
      const service = makeService({ from });
      await expect(service.listRecent()).rejects.toThrow('db down');
    });

    it('treats a null data payload as empty', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: null }));
      const service = makeService({ from });
      expect(await service.listRecent()).toEqual([]);
    });
  });

  describe('listAll()', () => {
    it('maps rows and defaults the limit to 5000', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawMatchRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listAll();
      expect(calls['limit'][0]).toEqual([5000]);
      expect(result).toEqual([mappedMatch]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('nope') }));
      const service = makeService({ from });
      await expect(service.listAll()).rejects.toThrow('nope');
    });
  });

  describe('listForPlayer()', () => {
    it('builds an OR filter across all four seat columns and defaults the limit to 100', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawMatchRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listForPlayer('a');
      expect(calls['or'][0][0]).toBe(
        'team_a_player_1.eq.a,team_a_player_2.eq.a,team_b_player_1.eq.a,team_b_player_2.eq.a'
      );
      expect(calls['limit'][0]).toEqual([100]);
      expect(result).toEqual([mappedMatch]);
    });

    it('passes a custom limit through', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [], error: null }, calls));
      const service = makeService({ from });
      await service.listForPlayer('a', 7);
      expect(calls['limit'][0]).toEqual([7]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('fail') }));
      const service = makeService({ from });
      await expect(service.listForPlayer('a')).rejects.toThrow('fail');
    });
  });

  describe('listRatingEvents()', () => {
    it('maps rows, filters by player and defaults the limit to 300', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({
        data: [{ match_id: 'm1', elo_before: 1000, elo_after: 1010, elo_delta: 10, created_at: 'c1' }],
        error: null
      }, calls));
      const service = makeService({ from });
      const result = await service.listRatingEvents('p1');
      expect(calls['eq'][0]).toEqual(['player_id', 'p1']);
      expect(calls['limit'][0]).toEqual([300]);
      expect(result).toEqual([{ matchId: 'm1', eloBefore: 1000, eloAfter: 1010, eloDelta: 10, createdAt: 'c1' }]);
    });

    it('passes a custom limit through and treats null data as empty', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: null, error: null }, calls));
      const service = makeService({ from });
      const result = await service.listRatingEvents('p1', 50);
      expect(calls['limit'][0]).toEqual([50]);
      expect(result).toEqual([]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('oops') }));
      const service = makeService({ from });
      await expect(service.listRatingEvents('p1')).rejects.toThrow('oops');
    });
  });

  describe('countAll()', () => {
    it('returns the count from the head-only query', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ count: 42, error: null }, calls));
      const service = makeService({ from });
      expect(await service.countAll()).toBe(42);
      expect(calls['select'][0]).toEqual(['id', { count: 'exact', head: true }]);
    });

    it('returns 0 when count is null', async () => {
      const from = vi.fn(() => queryStub({ count: null, error: null }));
      const service = makeService({ from });
      expect(await service.countAll()).toBe(0);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ count: null, error: new Error('count failed') }));
      const service = makeService({ from });
      await expect(service.countAll()).rejects.toThrow('count failed');
    });
  });
});
