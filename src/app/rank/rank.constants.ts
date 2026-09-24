import { RankTier } from '../core/models/rank-state';

export interface RankThreshold {
  tier: RankTier;
  division: 'I' | 'II' | 'III';
  floor: number;
}

export const STARTING_ELO = 520;
export const K_FACTOR = 32;
export const PLACEMENT_MATCHES_REQUIRED = 10;

/** Elo at and above which a player is Champion (no division, no RR). */
export const CHAMPION_FLOOR = 1340;

/** Width, in Elo points, of every normal (non-Lixo, non-Champion) division. */
export const DIVISION_WIDTH = 40;

export const RANK_THRESHOLDS: readonly RankThreshold[] = [
  { tier: 'Iron', division: 'I', floor: 500 }, { tier: 'Iron', division: 'II', floor: 540 }, { tier: 'Iron', division: 'III', floor: 580 },
  { tier: 'Bronze', division: 'I', floor: 620 }, { tier: 'Bronze', division: 'II', floor: 660 }, { tier: 'Bronze', division: 'III', floor: 700 },
  { tier: 'Silver', division: 'I', floor: 740 }, { tier: 'Silver', division: 'II', floor: 780 }, { tier: 'Silver', division: 'III', floor: 820 },
  { tier: 'Gold', division: 'I', floor: 860 }, { tier: 'Gold', division: 'II', floor: 900 }, { tier: 'Gold', division: 'III', floor: 940 },
  { tier: 'Platinum', division: 'I', floor: 980 }, { tier: 'Platinum', division: 'II', floor: 1020 }, { tier: 'Platinum', division: 'III', floor: 1060 },
  { tier: 'Diamond', division: 'I', floor: 1100 }, { tier: 'Diamond', division: 'II', floor: 1140 }, { tier: 'Diamond', division: 'III', floor: 1180 },
  { tier: 'Emerald', division: 'I', floor: 1220 }, { tier: 'Emerald', division: 'II', floor: 1260 }, { tier: 'Emerald', division: 'III', floor: 1300 }
];

/**
 * Ordered rank colors, loosely modeled after competitive shooters' tiered
 * rank ladders: cool, low-saturation tones at the bottom rising to warm,
 * saturated tones at the top, with Champion given a distinct gold/red
 * treatment as the single highest tier.
 */
export const RANK_COLORS: Record<RankTier | 'Unranked', string> = {
  Unranked: '#7c8797',
  Lixo: '#5b5f66',
  Iron: '#8a8f98',
  Bronze: '#a9713f',
  Silver: '#9fb0c3',
  Gold: '#d8b04a',
  Platinum: '#4fb3a9',
  Diamond: '#5b8def',
  Emerald: '#3fbf6f',
  Champion: '#e6533c'
};
