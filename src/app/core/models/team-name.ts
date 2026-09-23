export interface TeamName {
  id: string;
  playerLow: string;
  playerHigh: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Canonical, order-independent lookup key for a pair of player ids. Mirrors how the DB stores player_low < player_high. */
export function teamPairKey(playerA: string, playerB: string): string {
  return playerA < playerB ? `${playerA}|${playerB}` : `${playerB}|${playerA}`;
}
