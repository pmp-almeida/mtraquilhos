import { RankState } from './rank-state';

export interface Player {
  id: string;
  displayName: string;
  elo: number;
  peakElo: number;
  placementMatches: number;
  placementComplete: boolean;
  rank: RankState;
  demotionShield: boolean;
  wins: number;
  losses: number;
  isActive: boolean;
  createdAt: string;
}