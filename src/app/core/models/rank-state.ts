export type RankTier =
  | 'Lixo'
  | 'Iron'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Emerald'
  | 'Champion';

export type RankDivision = 'I' | 'II' | 'III' | null;

export interface RankState {
  tier: RankTier | 'Unranked';
  division: RankDivision;
  rr: number | null;
}