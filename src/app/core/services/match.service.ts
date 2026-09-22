import { Injectable } from '@angular/core';
import { MatchSummary, RecordMatchInput, RecordMatchResult } from '../models/match';
import { SupabaseService } from './supabase.service';

const MATCH_COLUMNS = 'id, played_at, winner, score_a, score_b, season_id, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2';

export interface RatingEvent {
  matchId: string;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  createdAt: string;
}

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
    const raw = data as any;
    return {
      matchId: raw.matchId,
      seasonId: raw.seasonId ?? null,
      expectedProbability: raw.expectedProbability,
      teamAElo: raw.teamAElo,
      teamBElo: raw.teamBElo,
      teamDelta: raw.teamDelta,
      players: (raw.players ?? []).map((p: any) => ({
        playerId: p.player_id, eloBefore: p.elo_before, eloAfter: p.elo_after, eloDelta: p.elo_delta,
        rankBefore: p.rank_before, rankAfter: p.rank_after, rrBefore: p.rr_before, rrAfter: p.rr_after,
        placementMatchesBefore: p.placement_matches_before, placementMatchesAfter: p.placement_matches_after,
        demotionShieldBefore: p.demotion_shield_before, demotionShieldAfter: p.demotion_shield_after
      }))
    };
  }

  async listRecent(limit = 20): Promise<MatchSummary[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('matches')
      .select(MATCH_COLUMNS).order('played_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map(row => this.mapRow(row));
  }

  async listForPlayer(playerId: string, limit = 100): Promise<MatchSummary[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('matches')
      .select(MATCH_COLUMNS)
      .or(`team_a_player_1.eq.${playerId},team_a_player_2.eq.${playerId},team_b_player_1.eq.${playerId},team_b_player_2.eq.${playerId}`)
      .order('played_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(row => this.mapRow(row));
  }

  /** Per-match Elo deltas for a player, newest first. Powers streaks and biggest gain/loss stats. */
  async listRatingEvents(playerId: string, limit = 300): Promise<RatingEvent[]> {
    if (!this.supabase.client) return [];
    const { data, error } = await this.supabase.client.from('rating_events')
      .select('match_id, elo_before, elo_after, elo_delta, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(row => ({
      matchId: row.match_id, eloBefore: row.elo_before, eloAfter: row.elo_after,
      eloDelta: row.elo_delta, createdAt: row.created_at
    }));
  }

  async countAll(): Promise<number> {
    if (!this.supabase.client) return 0;
    const { count, error } = await this.supabase.client.from('matches').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }

  private mapRow(row: any): MatchSummary {
    return {
      id: row.id,
      playedAt: row.played_at,
      winner: row.winner,
      scoreA: row.score_a,
      scoreB: row.score_b,
      seasonId: row.season_id ?? null,
      teamAPlayerIds: [row.team_a_player_1, row.team_a_player_2],
      teamBPlayerIds: [row.team_b_player_1, row.team_b_player_2],
      playerIds: [row.team_a_player_1, row.team_a_player_2, row.team_b_player_1, row.team_b_player_2]
    };
  }
}
