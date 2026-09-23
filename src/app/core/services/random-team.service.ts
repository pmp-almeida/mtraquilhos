import { Injectable } from '@angular/core';
import { Player } from '../models/player';

export interface RandomTeams { teamA: Player[]; teamB: Player[]; }
export type TeamGenerationMode = 'random' | 'balanced';

@Injectable({ providedIn: 'root' })
export class RandomTeamService {
  /**
   * Picks four players at random from the active pool -- who actually gets
   * to play stays a matter of luck either way -- then splits them into two
   * teams. In 'random' mode that split is itself random. In 'balanced' mode,
   * the four players are fixed but the app instead picks whichever of the
   * three possible 2v2 splits keeps the two teams' average Elo closest
   * together, for a fairer, closer match. Either way this has no effect on
   * Elo -- it's purely how sides get picked before the match is played.
   */
  generate(players: Player[], mode: TeamGenerationMode = 'random'): RandomTeams {
    if (players.length < 4) throw new Error('At least four active players are required');
    const four = [...players].sort(() => Math.random() - 0.5).slice(0, 4);
    return mode === 'balanced' ? this.balancedSplit(four) : { teamA: four.slice(0, 2), teamB: four.slice(2, 4) };
  }

  /** The three ways to split four fixed players into two teams of two, scored by how close their average Elo is -- the smallest gap wins. */
  private balancedSplit(four: Player[]): RandomTeams {
    const [p1, p2, p3, p4] = four;
    const splits: RandomTeams[] = [
      { teamA: [p1, p2], teamB: [p3, p4] },
      { teamA: [p1, p3], teamB: [p2, p4] },
      { teamA: [p1, p4], teamB: [p2, p3] }
    ];
    return splits.reduce((best, candidate) => this.eloGap(candidate) < this.eloGap(best) ? candidate : best);
  }

  private eloGap(teams: RandomTeams): number {
    const avg = (team: Player[]) => (team[0].elo + team[1].elo) / 2;
    return Math.abs(avg(teams.teamA) - avg(teams.teamB));
  }
}
