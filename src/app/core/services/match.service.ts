import { Injectable } from '@angular/core';
import { RecordMatchInput, RecordMatchResult } from '../models/match';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MatchService {
  constructor(private readonly supabase: SupabaseService) {}

  async record(input: RecordMatchInput): Promise<RecordMatchResult> {
    if (!this.supabase.client) throw new Error('Supabase is not configured');
    const { data, error } = await this.supabase.client.rpc('record_match', {
      p_team_a_player_1: input.teamAPlayer1, p_team_a_player_2: input.teamAPlayer2,
      p_team_b_player_1: input.teamBPlayer1, p_team_b_player_2: input.teamBPlayer2,
      p_winner: input.winner, p_score_a: input.scoreA ?? null, p_score_b: input.scoreB ?? null,
      p_played_at: input.playedAt ?? new Date().toISOString(), p_note: input.note ?? null
    });
    if (error) throw error;
    return data as RecordMatchResult;
  }
}