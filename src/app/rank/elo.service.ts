import { Injectable } from '@angular/core';
import { K_FACTOR } from './rank.constants';

export interface EloProjection { teamAElo: number; teamBElo: number; expectedA: number; deltaA: number; deltaB: number; }

@Injectable({ providedIn: 'root' })
export class EloService {
  project(teamAElo: [number, number], teamBElo: [number, number], winner: 'A' | 'B'): EloProjection {
    const a = (teamAElo[0] + teamAElo[1]) / 2;
    const b = (teamBElo[0] + teamBElo[1]) / 2;
    const expectedA = 1 / (1 + Math.pow(10, (b - a) / 400));
    const deltaA = Math.round(K_FACTOR * (winner === 'A' ? 1 - expectedA : -expectedA));
    return { teamAElo: a, teamBElo: b, expectedA, deltaA, deltaB: -deltaA };
  }
}