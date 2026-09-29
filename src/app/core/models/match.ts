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
  seasonId: string | null;
  /** Who actually won -- echoed straight back from the request, not derived from teamDelta (see that field's note: it can't tell you this). */
  winner: 'A' | 'B';
  expectedProbability: number;
  teamAElo: number;
  teamBElo: number;
  /**
   * The magnitude of the Elo swing for this match -- always >= 0, the same
   * value whichever team actually won, since the server computes it from
   * how surprising the result was (see record_match's v_delta), not from
   * which side gained or lost points. It is NOT signed by winner: do not
   * use `teamDelta >= 0` to infer who won, that's always true. Use
   * `winner` above instead.
   */
  teamDelta: number;
  players: PlayerMatchResult[];
}

export interface MatchSummary {
  id: string;
  playedAt: string;
  winner: 'A' | 'B';
  scoreA: number | null;
  scoreB: number | null;
  seasonId: string | null;
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  playerIds: string[];
}
