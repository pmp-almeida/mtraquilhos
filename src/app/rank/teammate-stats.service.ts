import { Injectable } from '@angular/core';
import { MatchSummary } from '../core/models/match';

export interface TeammateStat { playerId: string; matches: number; wins: number; losses: number; winRate: number; }

const MIN_MATCHES_TOGETHER = 5;

@Injectable({ providedIn: 'root' })
export class TeammateStatsService {
  /**
   * Builds the full teammate table for `playerId` from their match history
   * (spec section 26): for every match, the teammate is whichever other
   * player shared their team letter, and a win is counted when that team
   * letter matches the recorded winner.
   */
  computeFromMatches(playerId: string, matches: MatchSummary[]): TeammateStat[] {
    const totals = new Map<string, { matches: number; wins: number; losses: number }>();
    for (const match of matches) {
      const onTeamA = match.teamAPlayerIds.includes(playerId);
      const onTeamB = match.teamBPlayerIds.includes(playerId);
      if (!onTeamA && !onTeamB) continue;
      const teammateId = onTeamA
        ? match.teamAPlayerIds.find(id => id !== playerId)
        : match.teamBPlayerIds.find(id => id !== playerId);
      if (!teammateId) continue;
      const won = (onTeamA && match.winner === 'A') || (onTeamB && match.winner === 'B');
      const entry = totals.get(teammateId) ?? { matches: 0, wins: 0, losses: 0 };
      entry.matches += 1;
      if (won) entry.wins += 1; else entry.losses += 1;
      totals.set(teammateId, entry);
    }
    return [...totals.entries()].map(([id, stat]) => ({
      playerId: id, matches: stat.matches, wins: stat.wins, losses: stat.losses,
      winRate: stat.matches > 0 ? stat.wins / stat.matches : 0
    }));
  }

  best(stats: TeammateStat[]): TeammateStat | null { return this.select(stats, true); }
  worst(stats: TeammateStat[]): TeammateStat | null { return this.select(stats, false); }

  private select(stats: TeammateStat[], best: boolean): TeammateStat | null {
    const eligible = stats.filter(stat => stat.matches >= MIN_MATCHES_TOGETHER);
    return [...eligible].sort((a, b) => best
      ? b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId)
      : a.winRate - b.winRate || a.wins - b.wins || a.playerId.localeCompare(b.playerId))[0] ?? null;
  }
}
