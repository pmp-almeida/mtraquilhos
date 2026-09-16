import { Injectable } from '@angular/core';
import { RankState } from '../core/models/rank-state';
import { PLACEMENT_MATCHES_REQUIRED, RANK_THRESHOLDS } from './rank.constants';

@Injectable({ providedIn: 'root' })
export class RankService {
  calculate(elo: number, placementMatches: number): RankState {
    if (placementMatches < PLACEMENT_MATCHES_REQUIRED) return { tier: 'Unranked', division: null, rr: null };
    if (elo < 500) return { tier: 'Lixo', division: null, rr: null };
    if (elo >= 1340) return { tier: 'Champion', division: null, rr: null };
    const threshold = [...RANK_THRESHOLDS].reverse().find(candidate => elo >= candidate.floor)!;
    return { tier: threshold.tier, division: threshold.division, rr: Math.max(0, Math.min(99, Math.floor(((elo - threshold.floor) / 40) * 100))) };
  }

  label(state: RankState): string {
    return state.tier === 'Unranked' || state.division === null ? state.tier : `${state.tier} ${state.division}`;
  }
}