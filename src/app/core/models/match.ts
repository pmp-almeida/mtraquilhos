export interface RecordMatchInput {
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  winner: 'A' | 'B';
  scoreA?: number;
  scoreB?: number;
  playedAt?: string;
  note?: string;
}

export interface PlayerMatchResult {
  playerId: string;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  rankBefore: string;
  rankAfter: string;
  rrBefore: number | null;
  rrAfter: number | null;
  placementMatchesBefore: number;
  placementMatchesAfter: number;
  demotionShieldBefore: boolean;
  demotionShieldAfter: boolean;
}

export interface RecordMatchResult {
  matchId: string;
  expectedProbability: number;
  teamAElo: number;
  teamBElo: number;
  teamDelta: number;
  players: PlayerMatchResult[];
}