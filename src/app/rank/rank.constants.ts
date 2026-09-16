import { RankTier } from '../core/models/rank-state';

export interface RankThreshold {
  tier: RankTier;
  division: 'I' | 'II' | 'III';
  floor: number;
}

export const STARTING_ELO = 520;
export const K_FACTOR = 32;
export const PLACEMENT_MATCHES_REQUIRED = 5;

export const RANK_THRESHOLDS: readonly RankThreshold[] = [
  { tier: 'Iron', division: 'I', floor: 500 }, { tier: 'Iron', division: 'II', floor: 540 }, { tier: 'Iron', division: 'III', floor: 580 },
  { tier: 'Bronze', division: 'I', floor: 620 }, { tier: 'Bronze', division: 'II', floor: 660 }, { tier: 'Bronze', division: 'III', floor: 700 },
  { tier: 'Silver', division: 'I', floor: 740 }, { tier: 'Silver', division: 'II', floor: 780 }, { tier: 'Silver', division: 'III', floor: 820 },
  { tier: 'Gold', division: 'I', floor: 860 }, { tier: 'Gold', division: 'II', floor: 900 }, { tier: 'Gold', division: 'III', floor: 940 },
  { tier: 'Platinum', division: 'I', floor: 980 }, { tier: 'Platinum', division: 'II', floor: 1020 }, { tier: 'Platinum', division: 'III', floor: 1060 },
  { tier: 'Diamond', division: 'I', floor: 1100 }, { tier: 'Diamond', division: 'II', floor: 1140 }, { tier: 'Diamond', division: 'III', floor: 1180 },
  { tier: 'Emerald', division: 'I', floor: 1220 }, { tier: 'Emerald', division: 'II', floor: 1260 }, { tier: 'Emerald', division: 'III', floor: 1300 }
];