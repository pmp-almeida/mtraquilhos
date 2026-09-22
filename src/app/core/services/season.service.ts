import { Injectable } from '@angular/core';
import { PlayerSeasonStats, Season, StartSeasonResult } from '../models/season';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class SeasonService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<Season[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client
      .from('seasons').select('*').order('season_number', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => this.mapSeason(row));
  }

  async getActive(): Promise<Season | null> {
    if (!this.supabase.client) return null;
    const { data, error } = await this.supabase.client
      .from('seasons').select('*').eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? this.mapSeason(data) : null;
  }

  async leaderboard(seasonId: string): Promise<PlayerSeasonStats[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client
      .from('player_season_stats').select('*').eq('season_id', seasonId).order('current_elo', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => this.mapStats(row));
  }

  async historyForPlayer(playerId: string): Promise<PlayerSeasonStats[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client
      .from('player_season_stats').select('*').eq('player_id', playerId);
    if (error) throw error;
    return (data ?? []).map(row => this.mapStats(row));
  }

  async start(name: string, compressionFactor: number): Promise<StartSeasonResult> {
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.supabase.client.rpc('start_season', {
      p_name: name,
      p_compression_factor: compressionFactor
    });
    if (error) throw error;
    return {
      seasonId: data.seasonId,
      seasonNumber: data.seasonNumber,
      name: data.name,
      compressionFactor: data.compressionFactor,
      meanElo: data.meanElo,
      playersCompressed: data.playersCompressed
    };
  }

  private mapSeason(row: any): Season {
    return {
      id: row.id,
      seasonNumber: row.season_number,
      name: row.name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      isActive: row.is_active,
      compressionFactor: row.compression_factor
    };
  }

  private mapStats(row: any): PlayerSeasonStats {
    return {
      seasonId: row.season_id,
      playerId: row.player_id,
      startingElo: row.starting_elo,
      currentElo: row.current_elo,
      peakElo: row.peak_elo,
      finalRank: row.final_rank,
      finalRr: row.final_rr,
      wins: row.wins,
      losses: row.losses,
      matchesPlayed: row.matches_played
    };
  }
}
