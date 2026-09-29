import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TeamNameService } from './team-name.service';
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

function makeService(client: any): TeamNameService {
  TestBed.configureTestingModule({
    providers: [TeamNameService, { provide: SupabaseService, useValue: { client } }]
  });
  return TestBed.inject(TeamNameService);
}

const rawRow = {
  id: 't1', player_low: 'a', player_high: 'b', name: 'The Aces', created_at: 'c1', updated_at: 'u1'
};
const mappedName = {
  id: 't1', playerLow: 'a', playerHigh: 'b', name: 'The Aces', createdAt: 'c1', updatedAt: 'u1'
};

describe('TeamNameService', () => {
  describe('with no configured client', () => {
    const service = makeService(null);

    it('listAll() returns []', async () => {
      expect(await service.listAll()).toEqual([]);
    });

    it('nameMap() returns {}', async () => {
      expect(await service.nameMap()).toEqual({});
    });

    it('setName() throws', async () => {
      await expect(service.setName('a', 'b', 'The Aces')).rejects.toThrow('Supabase is not configured');
    });

    it('clear() throws', async () => {
      await expect(service.clear('a', 'b')).rejects.toThrow('Supabase is not configured');
    });
  });

  describe('listAll()', () => {
    it('orders by name ascending and maps rows', async () => {
      const calls: Record<string, any[][]> = {};
      const from = vi.fn(() => queryStub({ data: [rawRow], error: null }, calls));
      const service = makeService({ from });
      const result = await service.listAll();
      expect(from).toHaveBeenCalledWith('team_names');
      expect(calls['order'][0]).toEqual(['name', { ascending: true }]);
      expect(result).toEqual([mappedName]);
    });

    it('rejects on query error', async () => {
      const from = vi.fn(() => queryStub({ data: null, error: new Error('boom') }));
      const service = makeService({ from });
      await expect(service.listAll()).rejects.toThrow('boom');
    });
  });

  describe('nameMap()', () => {
    it('keys by the pair key derived from player_low/player_high, regardless of row order', async () => {
      const from = vi.fn(() => queryStub({
        data: [
          { player_low: 'a', player_high: 'b', name: 'The Aces' },
          { player_low: 'c', player_high: 'd', name: 'Dream Team' }
        ],
        error: null
      }));
      const service = makeService({ from });
      const map = await service.nameMap();
      expect(map).toEqual({ 'a|b': 'The Aces', 'c|d': 'Dream Team' });
    });

    it('produces the same key whichever row field order the DB happens to store', async () => {
      // The pair key is derived purely from string comparison of the two
      // ids, so it must not depend on which one the DB calls "low"/"high".
      const from = vi.fn(() => queryStub({
        data: [{ player_low: 'z', player_high: 'a', name: 'Weird Order' }],
        error: null
      }));
      const service = makeService({ from });
      const map = await service.nameMap();
      // 'a' < 'z' lexicographically, so the key must be 'a|z' even though
      // the DB row calls 'z' the "low" one.
      expect(map).toEqual({ 'a|z': 'Weird Order' });
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

  describe('setName()', () => {
    it('sends both player ids and the name to the RPC and maps the returned row', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: rawRow, error: null });
      const service = makeService({ rpc });
      const result = await service.setName('a', 'b', 'The Aces');
      expect(rpc).toHaveBeenCalledWith('set_team_name', { p_player_1: 'a', p_player_2: 'b', p_name: 'The Aces' });
      expect(result).toEqual(mappedName);
    });

    it('rejects on RPC error', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('duplicate name') });
      const service = makeService({ rpc });
      await expect(service.setName('a', 'b', 'The Aces')).rejects.toThrow('duplicate name');
    });
  });

  describe('clear()', () => {
    it('sends both player ids to the RPC', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
      const service = makeService({ rpc });
      await service.clear('a', 'b');
      expect(rpc).toHaveBeenCalledWith('clear_team_name', { p_player_1: 'a', p_player_2: 'b' });
    });

    it('rejects on RPC error', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('no such team') });
      const service = makeService({ rpc });
      await expect(service.clear('a', 'b')).rejects.toThrow('no such team');
    });
  });
});
