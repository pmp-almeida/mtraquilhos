import { Injectable } from '@angular/core';

export interface TeammateStat { playerId: string; matches: number; wins: number; losses: number; winRate: number; }

@Injectable({ providedIn: 'root' })
export class TeammateStatsService {
  best(stats: TeammateStat[]): TeammateStat | null { return this.select(stats, true); }
  worst(stats: TeammateStat[]): TeammateStat | null { return this.select(stats, false); }

  private select(stats: TeammateStat[], best: boolean): TeammateStat | null {
    const eligible = stats.filter(stat => stat.matches >= 5);
    return [...eligible].sort((a, b) => best
      ? b.winRate - a.winRate || b.wins - a.wins || a.playerId.localeCompare(b.playerId)
      : a.winRate - b.winRate || a.wins - b.wins || a.playerId.localeCompare(b.playerId))[0] ?? null;
  }
}