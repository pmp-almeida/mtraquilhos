export interface Season {
  id: string;
  seasonNumber: number;
  name: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
  compressionFactor: number;
}

export interface PlayerSeasonStats {
  seasonId: string;
  playerId: string;
  startingElo: number;
  currentElo: number;
  peakElo: number;
  finalRank: string | null;
  finalRr: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export interface StartSeasonResult {
  seasonId: string;
  seasonNumber: number;
  name: string;
  compressionFactor: number;
  meanElo: number;
  playersCompressed: number;
}
