import { Injectable } from '@angular/core';
import { MatchSummary } from '../core/models/match';

export interface HeadToHeadStat { playerId: string; matches: number; wins: number; losses: number; winRate: number; }

// Same minimum-sample rule as Best/Worst Teammate (spec section 23) so a
// single lucky or unlucky result can't crown a "rival" outright.
const MIN_MATCHES_AGAINST = 5;

/**
 * Per-opponent record for one player, mirroring TeammateStatsService's
 * shape and rules but built from the OTHER team instead of your own: a 2v2
 * match has two opponents, so (unlike a teammate) every match contributes
 * to two separate opponent totals at once.
 */
@Injectable({ providedIn: 'root' })
export class HeadToHeadStatsService {
  computeFromMatches(playerId: string, matches: MatchSummary[]): HeadToHeadStat[] {
    const totals = new Map<string, { matches: number; wins: number; losses: number }>();
    for (const match of matches) {
      const onTeamA = match.teamAPlayerIds.includes(playerId);
      const onTeamB = match.teamBPlayerIds.includes(playerId);
      if (!onTeamA && !onTeamB) continue;
      const opponents = onTeamA ? match.teamBPlayerIds : match.teamAPlayerIds;
      const won = (onTeamA && match.winner === 'A') || (onTeamB && match.winner === 'B');
      for (const opponentId of opponents) {
        const entry = totals.get(opponentId) ?? { matches: 0, wins: 0, losses: 0 };
        entry.matches += 1;
        if (won) entry.wins += 1; else entry.losses += 1;
        totals.set(opponentId, entry);
      }
    }
    return [...totals.entries()].map(([id, stat]) => ({
      playerId: id, matches: stat.matches, wins: stat.wins, losses: stat.losses,
      winRate: stat.matches > 0 ? stat.wins / stat.matches : 0
    }));
  }

  /** The opponent this player has the best record against -- their favourite matchup. */
  bestMatchup(stats: HeadToHeadStat[]): HeadToHeadStat | null { return this.select(stats, true); }
  /** The opponent this player struggles against the most -- their toughest rival. */
  worstMatchup(stats: HeadToHeadStat[]): HeadToHeadStat | null { return this.select(stats, false); }

  private select(stats: HeadToHeadStat[], best: boolean): HeadToHeadStat | null {
    const eligible = stats.filter(stat => stat.matches >= MIN_MATCHES_AGAINST);
    return [...eligible].sort((a, b) => best
      ? b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId)
      : a.winRate - b.winRate || a.wins - b.wins || a.playerId.localeCompare(b.playerId))[0] ?? null;
  }
}
