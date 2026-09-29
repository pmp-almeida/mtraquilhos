import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlayerService } from './player.service';
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

function makeService(client: any): PlayerService {
  TestBed.configureTestingModule({
    providers: [PlayerService, { provide: SupabaseService, useValue: { client } }]
  });
  return TestBed.inject(PlayerService);
}

const rawPlayerRow = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'p1', display_name: 'Alice', current_elo: 1050, peak_elo: 1080,
  placement_matches_played: 5, placement_complete: true, visible_rank: 'Iron I', rr: 60,
  demotion_shield_active: false, demotion_pending: false, wins: 5, losses: 2, active: true,
  created_at: 'c1',
  ...overrides
});

const mappedPlayer = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'p1', displayName: 'Alice', elo: 1050, peakElo: 1080, placementMatches: 5,
  placementComplete: true, rank: { tier: 'Iron', division: 'I', rr: 60 },
  demotionShield: false, demotionPending: false, wins: 5, losses: 2, isActive: true, createdAt: 'c1',
  ...overrides
});

describe('PlayerService', () => {
  describe('with no configured client', () => {
    const service = makeService(null);

    it('listActive() returns []', async () => {
      expect(await service.listActive()).toEqual([]);
    });

    it('listAll() returns []', async () => {
      expect(await service.listAll()).toEqual([]);
    });

    it('setActive() throws', async () => {
      await expect(service.setActive('p1', false)).rejects.toThrow('Supabase is not configured');
    });

    it('getById() returns null', async () => {
      expect(await service.getById('p1')).toBeNull();
    });

    it('nameMap() returns {}', async () => {
      expect(await service.nameMap()).toEqual({});
    });

    it('create() throws "Supabase is not configured" for a non-empty name', async () => {
      await expect(service.create('Bob')).rejects.toThrow('Supabase is not configured');
    });

    it('create() throws the name-required error even before touching the client, for a blank name', async () => {
      await expect(service.create('   ')).rejects.toThrow('Player name is required');
    });
  });

  describe('listActive()', () => {
    it('filters active=true, orders by current_elo descending, and maps rows', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawPlayerRow()], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listActive();
      expect(from).toHaveBeenCalledWith('players');
      expect(calls['eq'][0]).toEqual(['active', true]);
      expect(calls['order'][0]).toEqual(['current_elo', { ascending: false }]);
      expect(result).toEqual([mappedPlayer()]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('boom') }));
      const service = makeService({ from });
      await expect(service.listActive()).rejects.toThrow('boom');
    });
  });

  describe('listAll()', () => {
    it('orders by active then current_elo, both descending', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawPlayerRow()], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listAll();
      expect(calls['order']).toEqual([
        ['active', { ascending: false }],
        ['current_elo', { ascending: false }]
      ]);
      expect(result).toEqual([mappedPlayer()]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('fail') }));
      const service = makeService({ from });
      await expect(service.listAll()).rejects.toThrow('fail');
    });
  });

  describe('setActive()', () => {
    it('updates the active column for the given id', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ error: null }, calls));
      const service = makeService({ from });
      await service.setActive('p1', false);
      expect(calls['update'][0]).toEqual([{ active: false }]);
      expect(calls['eq'][0]).toEqual(['id', 'p1']);
    });

    it('rejects on error', async () => {
      const from = vi.fn(() => queryStub({ error: new Error('not allowed') }));
      const service = makeService({ from });
      await expect(service.setActive('p1', true)).rejects.toThrow('not allowed');
    });
  });

  describe('getById()', () => {
    it('filters by id and maps a found row', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: rawPlayerRow(), error: null }, calls));
      const service = makeService({ from });
      const result = await service.getById('p1');
      expect(calls['eq'][0]).toEqual(['id', 'p1']);
      expect(result).toEqual(mappedPlayer());
    });

    it('returns null when no player is found', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: null }));
      const service = makeService({ from });
      expect(await service.getById('missing')).toBeNull();
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('oops') }));
      const service = makeService({ from });
      await expect(service.getById('p1')).rejects.toThrow('oops');
    });
  });

  describe('nameMap()', () => {
    it('maps id -> display_name for every returned row', async () => {
      const from = vi.fn(() => queryStub({
        data: [{ id: 'p1', display_name: 'Alice' }, { id: 'p2', display_name: 'Bob' }],
        error: null
      }));
      const service = makeService({ from });
      expect(await service.nameMap()).toEqual({ p1: 'Alice', p2: 'Bob' });
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('fail') }));
      const service = makeService({ from });
      await expect(service.nameMap()).rejects.toThrow('fail');
    });

    it('treats null data as an empty map', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: null }));
      const service = makeService({ from });
      expect(await service.nameMap()).toEqual({});
    });
  });

  describe('create()', () => {
    it('trims the name before inserting and maps the returned row', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: rawPlayerRow({ display_name: 'Alice' }), error: null }, calls));
      const service = makeService({ from });
      const result = await service.create('  Alice  ');
      expect(calls['insert'][0]).toEqual([{ display_name: 'Alice' }]);
      expect(result).toEqual(mappedPlayer());
    });

    it('throws before touching the client when the name is empty after trimming', async () => {
      const from = vi.fn();
      const service = makeService({ from });
      await expect(service.create('   ')).rejects.toThrow('Player name is required');
      expect(from).not.toHaveBeenCalled();
    });

    it('throws for a completely empty string too', async () => {
      const service = makeService({ from: vi.fn() });
      await expect(service.create('')).rejects.toThrow('Player name is required');
    });

    it('rejects on insert error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('duplicate name') }));
      const service = makeService({ from });
      await expect(service.create('Alice')).rejects.toThrow('duplicate name');
    });
  });

  describe('mapPlayer (visible_rank splitting, via listActive)', () => {
    it('splits a "Tier Division" visible_rank into separate tier and division', async () => {
      const from = vi.fn(() => queryStub({ data: [rawPlayerRow({ visible_rank: 'Bronze III' })], error: null }));
      const service = makeService({ from });
      const [player] = await service.listActive();
      expect(player.rank.tier).toBe('Bronze');
      expect(player.rank.division).toBe('III');
    });

    it('treats "Unranked" (no division) as tier "Unranked" with a null division', async () => {
      const from = vi.fn(() => queryStub({ data: [rawPlayerRow({ visible_rank: 'Unranked' })], error: null }));
      const service = makeService({ from });
      const [player] = await service.listActive();
      expect(player.rank.tier).toBe('Unranked');
      expect(player.rank.division).toBeNull();
    });

    it('defaults to "Unranked" with a null division when visible_rank is null', async () => {
      const from = vi.fn(() => queryStub({ data: [rawPlayerRow({ visible_rank: null })], error: null }));
      const service = makeService({ from });
      const [player] = await service.listActive();
      expect(player.rank.tier).toBe('Unranked');
      expect(player.rank.division).toBeNull();
    });
  });
});
