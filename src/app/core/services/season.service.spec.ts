import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SeasonService } from './season.service';
import { SupabaseService } from './supabase.service';

function queryStub(result: { data?: any; error?: any }, calls: Record<string, any[][]> = {}) {
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

function makeService(client: any): SeasonService {
  TestBed.configureTestingModule({
    providers: [SeasonService, { provide: SupabaseService, useValue: { client } }]
  });
  return TestBed.inject(SeasonService);
}

const rawSeasonRow = {
  id: 's1', season_number: 3, name: 'Season 3', started_at: '2026-01-01', ended_at: null,
  is_active: true, compression_factor: 0.5
};
const mappedSeason = {
  id: 's1', seasonNumber: 3, name: 'Season 3', startedAt: '2026-01-01', endedAt: null,
  isActive: true, compressionFactor: 0.5
};

const rawStatsRow = {
  season_id: 's1', player_id: 'p1', starting_elo: 1000, current_elo: 1050, peak_elo: 1080,
  final_rank: 'Iron I', final_rr: 60, wins: 5, losses: 2, matches_played: 7
};
const mappedStats = {
  seasonId: 's1', playerId: 'p1', startingElo: 1000, currentElo: 1050, peakElo: 1080,
  finalRank: 'Iron I', finalRr: 60, wins: 5, losses: 2, matchesPlayed: 7
};

describe('SeasonService', () => {
  describe('with no configured client', () => {
    const service = makeService(null);

    it('list() returns []', async () => {
      expect(await service.list()).toEqual([]);
    });

    it('getActive() returns null', async () => {
      expect(await service.getActive()).toBeNull();
    });

    it('leaderboard() returns []', async () => {
      expect(await service.leaderboard('s1')).toEqual([]);
    });

    it('historyForPlayer() returns []', async () => {
      expect(await service.historyForPlayer('p1')).toEqual([]);
    });

    it('start() throws', async () => {
      await expect(service.start('Season 4', 0.5)).rejects.toThrow('Supabase is not configured');
    });
  });

  describe('list()', () => {
    it('orders by season_number descending and maps rows', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawSeasonRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.list();
      expect(from).toHaveBeenCalledWith('seasons');
      expect(calls['order'][0]).toEqual(['season_number', { ascending: false }]);
      expect(result).toEqual([mappedSeason]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('boom') }));
      const service = makeService({ from });
      await expect(service.list()).rejects.toThrow('boom');
    });

    it('treats null data as empty', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: null }));
      const service = makeService({ from });
      expect(await service.list()).toEqual([]);
    });
  });

  describe('getActive()', () => {
    it('filters on is_active and maps a found row', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: rawSeasonRow, error: null }, calls));
      const service = makeService({ from });
      const result = await service.getActive();
      expect(calls['eq'][0]).toEqual(['is_active', true]);
      expect(result).toEqual(mappedSeason);
    });

    it('returns null when no active season exists', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: null }));
      const service = makeService({ from });
      expect(await service.getActive()).toBeNull();
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('fail') }));
      const service = makeService({ from });
      await expect(service.getActive()).rejects.toThrow('fail');
    });
  });

  describe('leaderboard()', () => {
    it('filters by season_id, orders by current_elo descending, and maps rows', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawStatsRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.leaderboard('s1');
      expect(calls['eq'][0]).toEqual(['season_id', 's1']);
      expect(calls['order'][0]).toEqual(['current_elo', { ascending: false }]);
      expect(result).toEqual([mappedStats]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('no leaderboard') }));
      const service = makeService({ from });
      await expect(service.leaderboard('s1')).rejects.toThrow('no leaderboard');
    });
  });

  describe('historyForPlayer()', () => {
    it('filters by player_id and maps rows', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawStatsRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.historyForPlayer('p1');
      expect(calls['eq'][0]).toEqual(['player_id', 'p1']);
      expect(result).toEqual([mappedStats]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('no history') }));
      const service = makeService({ from });
      await expect(service.historyForPlayer('p1')).rejects.toThrow('no history');
    });
  });

  describe('start()', () => {
    it('sends name and compressionFactor to the RPC and maps the camelCase result through unchanged', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: {
          seasonId: 's2', seasonNumber: 4, name: 'Season 4', compressionFactor: 0.6,
          meanElo: 1015, playersCompressed: 12
        },
        error: null
      });
      const service = makeService({ rpc });
      const result = await service.start('Season 4', 0.6);
      expect(rpc).toHaveBeenCalledWith('start_season', { p_name: 'Season 4', p_compression_factor: 0.6 });
      expect(result).toEqual({
        seasonId: 's2', seasonNumber: 4, name: 'Season 4', compressionFactor: 0.6,
        meanElo: 1015, playersCompressed: 12
      });
    });

    it('rejects on RPC error', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('active season already exists') });
      const service = makeService({ rpc });
      await expect(service.start('Season 4', 0.5)).rejects.toThrow('active season already exists');
    });
  });
});
