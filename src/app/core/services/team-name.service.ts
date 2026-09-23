import { Injectable } from '@angular/core';
import { TeamName, teamPairKey } from '../models/team-name';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class TeamNameService {
  constructor(private readonly supabase: SupabaseService) {}

  async listAll(): Promise<TeamName[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('team_names').select('*').order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(row => this.mapRow(row));
  }

  /** Pair key ("lowId|highId") -> team name, for every named team. Purely a display lookup -- has no effect on Elo, RR, or rank. */
  async nameMap(): Promise<Record<string, string>> {
    if (!this.supabase.client) return {};
    const { data, error } = await this.supabase.client.from('team_names').select('player_low, player_high, name');
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[teamPairKey(row.player_low, row.player_high)] = row.name;
    return map;
  }

  /** Creates or renames the team for this unordered pair of players. */
  async setName(playerA: string, playerB: string, name: string): Promise<TeamName> {
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.supabase.client.rpc('set_team_name', {
      p_player_1: playerA, p_player_2: playerB, p_name: name
    });
    if (error) throw error;
    return this.mapRow(data);
  }

  /** Clears the custom name for this pair; they fall back to "PlayerA & PlayerB" everywhere. */
  async clear(playerA: string, playerB: string): Promise<void> {
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { error } = await this.supabase.client.rpc('clear_team_name', { p_player_1: playerA, p_player_2: playerB });
    if (error) throw error;
  }

  private mapRow(row: any): TeamName {
    return {
      id: row.id, playerLow: row.player_low, playerHigh: row.player_high,
      name: row.name, createdAt: row.created_at, updatedAt: row.updated_at
    };
  }
}
