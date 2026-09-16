import { Injectable } from '@angular/core';
import { Player } from '../models/player';

export interface RandomTeams { teamA: Player[]; teamB: Player[]; }

@Injectable({ providedIn: 'root' })
export class RandomTeamService {
  generate(players: Player[]): RandomTeams {
    if (players.length < 4) throw new Error('At least four active players are required');
    const pool = [...players].sort(() => Math.random() - 0.5);
    return { teamA: pool.slice(0, 2), teamB: pool.slice(2, 4) };
  }
}