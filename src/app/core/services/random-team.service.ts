import { Injectable } from '@angular/core';
import { Player } from '../models/player';

export interface RandomTeams { teamA: Player[]; teamB: Player[]; }
export type TeamGenerationMode = 'random' | 'balanced';

@Injectable({ providedIn: 'root' })
export class RandomTeamService {
  /**
   * How many matches each player has actually started this session (this
   * browser tab, reset on reload) -- incremented by `recordPlayed`, which
   * every place that actually begins a live or manually-recorded match
   * calls with its four participants, not by `generate`/`pickFairly`
   * themselves (a shuffle someone previews and then reshuffles or
   * abandons shouldn't count against anyone). Read by `pickFairly` to bias
   * future picks toward whoever's played the least so far tonight.
   */
  private readonly sessionPlayCount = new Map<string, number>();

  /**
   * Picks four players from the active pool -- weighted toward whoever's
   * played the fewest matches this session, see `pickFairly` -- then
   * splits them into two teams. In 'random' mode that split is itself
   * random. In 'balanced' mode, the four players are fixed but the app
   * instead picks whichever of the three possible 2v2 splits keeps the
   * two teams' average Elo closest together, for a fairer, closer match.
   * Either way this has no effect on Elo -- it's purely how sides get
   * picked before the match is played.
   */
  generate(players: Player[], mode: TeamGenerationMode = 'random'): RandomTeams {
    if (players.length < 4) throw new Error('At least four active players are required');
    const four = this.pickFairly(players, 4);
    return mode === 'balanced' ? this.balancedSplit(four) : { teamA: four.slice(0, 2), teamB: four.slice(2, 4) };
  }

  /**
   * Weighted sample of `count` distinct players out of `pool`, favouring
   * whoever has the lowest session play count -- not a strict rotation
   * (everyone always has some chance, nobody is ever a guaranteed pick or
   * a guaranteed miss), just softer odds against a long unlucky streak of
   * sitting out. A player who hasn't played yet tonight is three times as
   * likely to be drawn as someone who's already played two matches, ten
   * times as likely as someone on five, and so on -- weight is
   * `1 / (1 + timesPlayed)`. Returns fewer than `count` if the pool is
   * smaller than that.
   */
  pickFairly(pool: Player[], count: number): Player[] {
    const remaining = [...pool];
    const picked: Player[] = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const weights = remaining.map(p => 1 / (1 + (this.sessionPlayCount.get(p.id) ?? 0)));
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = Math.random() * total;
      let chosenIndex = remaining.length - 1;
      for (let j = 0; j < weights.length; j++) {
        roll -= weights[j];
        if (roll <= 0) { chosenIndex = j; break; }
      }
      picked.push(remaining.splice(chosenIndex, 1)[0]);
    }
    return picked;
  }

  /** Marks these players as having actually started a match this session, so `pickFairly` weighs future picks against them a little. Call once per match that really begins -- not per shuffle preview. */
  recordPlayed(playerIds: string[]): void {
    for (const id of playerIds) this.sessionPlayCount.set(id, (this.sessionPlayCount.get(id) ?? 0) + 1);
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
