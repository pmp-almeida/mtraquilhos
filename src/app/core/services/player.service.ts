import { Injectable } from '@angular/core';
import { Player } from '../models/player';
import { STARTING_ELO } from '../../rank/rank.constants';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  constructor(private readonly supabase: SupabaseService) {}

  async listActive(): Promise<Player[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('players').select('*').eq('active', true).order('current_elo', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Player[];
  }

  async create(displayName: string): Promise<Player> {
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.supabase.client.from('players').insert({ display_name: displayName.trim(), starting_elo: STARTING_ELO }).select().single();
    if (error) throw error;
    return data as Player;
  }
}