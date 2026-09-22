import { Injectable } from '@angular/core';
import { Player } from '../models/player';
import { SupabaseService } from './supabase.service';
import { RankDivision, RankTier } from '../models/rank-state';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  constructor(private readonly supabase: SupabaseService) {}

  async listActive(): Promise<Player[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('players').select('*').eq('active', true).order('current_elo', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => this.mapPlayer(row));
  }

  async getById(id: string): Promise<Player | null> {
    if (!this.supabase.client) return null;
    const { data, error } = await this.supabase.client.from('players').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? this.mapPlayer(data) : null;
  }

  /** Id -> display name for every player, active or not. Used to resolve names in match/teammate history. */
  async nameMap(): Promise<Record<string, string>> {
    if (!this.supabase.client) return {};
    const { data, error } = await this.supabase.client.from('players').select('id, display_name');
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.id] = row.display_name;
    return map;
  }

  async create(displayName: string): Promise<Player> {
    const name = displayName.trim();
    if (!name) throw new Error('Player name is required');
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.supabase.client.from('players').insert({ display_name: name }).select().single();
    if (error) throw error;
    return this.mapPlayer(data);
  }

  private mapPlayer(row: any): Player {
    const [tier, division] = String(row.visible_rank ?? 'Unranked').split(' ');
    return {
      id: row.id, displayName: row.display_name, elo: row.current_elo, peakElo: row.peak_elo,
      placementMatches: row.placement_matches_played, placementComplete: row.placement_complete,
      rank: { tier: tier as RankTier | 'Unranked', division: (division ?? null) as RankDivision, rr: row.rr },
      demotionShield: row.demotion_shield_active, demotionPending: row.demotion_pending,
      wins: row.wins, losses: row.losses, isActive: row.active, createdAt: row.created_at
    };
  }
}
