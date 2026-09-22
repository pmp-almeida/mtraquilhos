import { Injectable } from '@angular/core';
import { RankState } from '../core/models/rank-state';
import { CHAMPION_FLOOR, PLACEMENT_MATCHES_REQUIRED, RANK_THRESHOLDS } from './rank.constants';

@Injectable({ providedIn: 'root' })
export class RankService {
  calculate(elo: number, placementMatches: number): RankState {
    if (placementMatches < PLACEMENT_MATCHES_REQUIRED) return { tier: 'Unranked', division: null, rr: null };
    if (elo < 500) return { tier: 'Lixo', division: null, rr: null };
    if (elo >= CHAMPION_FLOOR) return { tier: 'Champion', division: null, rr: null };
    const threshold = [...RANK_THRESHOLDS].reverse().find(candidate => elo >= candidate.floor)!;
    return { tier: threshold.tier, division: threshold.division, rr: Math.max(0, Math.min(99, Math.floor(((elo - threshold.floor) / 40) * 100))) };
  }

  label(state: RankState): string {
    return state.tier === 'Unranked' || state.division === null ? state.tier : `${state.tier} ${state.division}`;
  }

  /**
   * Mirrors the server-side Demotion Shield trigger condition (see the
   * `record_match` RPC): a ranked player sits "at the floor" of their
   * current rank when they are at 0 RR in a normal division, or when they
   * are Champion (which has no RR and therefore no other floor signal).
   * Used client-side only for the record-match projection preview; the
   * database remains authoritative for the actual outcome.
   */
  isAtDivisionFloor(state: RankState): boolean {
    if (state.tier === 'Champion') return true;
    if (state.tier === 'Unranked' || state.tier === 'Lixo') return false;
    return state.rr === 0;
  }
}
