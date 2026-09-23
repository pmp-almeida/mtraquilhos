import { Injectable } from '@angular/core';
import { MatchSummary } from '../core/models/match';
import { Player } from '../core/models/player';

export interface TeamPairStat { playerLow: string; playerHigh: string; matches: number; wins: number; losses: number; winRate: number; }
export interface CarryStat { playerId: string; liftRate: number; partners: number; matches: number; }

// Same minimum-sample discipline as TeammateStatsService (spec section 23):
// a pair that's only played once or twice shouldn't be able to top a
// leaderboard purely on a lucky streak.
const MIN_TEAM_MATCHES = 5;
// How many of a partner's OTHER matches (without this player) are needed
// before their "solo" win rate is trusted enough to compare against.
const MIN_SOLO_MATCHES = 5;

/**
 * Club-wide teammate-pair statistics, powering the Teams page's "Best
 * Teams" leaderboard and "The One Who Carries" fact -- distinct from
 * TeammateStatsService, which builds a single player's own teammate table
 * from their point of view. This service aggregates every pair in the
 * whole match history at once.
 */
@Injectable({ providedIn: 'root' })
export class TeamStatsService {
  /** Aggregates every match into per-unordered-pair teammate totals (both sides of every match contribute one pair each). */
  computePairs(matches: MatchSummary[]): TeamPairStat[] {
    const totals = new Map<string, { a: string; b: string; matches: number; wins: number; losses: number }>();
    const bump = (ids: readonly [string, string], won: boolean) => {
      const [a, b] = [...ids].sort();
      const key = `${a}|${b}`;
      const entry = totals.get(key) ?? { a, b, matches: 0, wins: 0, losses: 0 };
      entry.matches += 1;
      if (won) entry.wins += 1; else entry.losses += 1;
      totals.set(key, entry);
    };
    for (const match of matches) {
      bump(match.teamAPlayerIds, match.winner === 'A');
      bump(match.teamBPlayerIds, match.winner === 'B');
    }
    return [...totals.values()].map(e => ({
      playerLow: e.a, playerHigh: e.b, matches: e.matches, wins: e.wins, losses: e.losses,
      winRate: e.matches > 0 ? e.wins / e.matches : 0
    }));
  }

  /**
   * Pairs with at least the minimum matches together, best win rate first.
   * Tie-break mirrors the deterministic Best/Worst Teammate rule (spec
   * section 25): more matches together, then a stable id-based sort so the
   * result never depends on map/array iteration order.
   */
  bestTeams(pairs: TeamPairStat[], limit = 5): TeamPairStat[] {
    return [...pairs]
      .filter(p => p.matches >= MIN_TEAM_MATCHES)
      .sort((a, b) =>
        b.winRate - a.winRate ||
        b.matches - a.matches ||
        `${a.playerLow}${a.playerHigh}`.localeCompare(`${b.playerLow}${b.playerHigh}`)
      )
      .slice(0, limit);
  }

  /** The pair that has played together the most, win rate aside -- a fun "who ends up together constantly" fact rather than a ranking. */
  mostPlayedTogether(pairs: TeamPairStat[]): TeamPairStat | null {
    if (!pairs.length) return null;
    return [...pairs].sort((a, b) =>
      b.matches - a.matches ||
      b.winRate - a.winRate ||
      `${a.playerLow}${a.playerHigh}`.localeCompare(`${b.playerLow}${b.playerHigh}`)
    )[0];
  }

  /**
   * "The One Who Carries": for every player X and every regular partner Y
   * they've played at least MIN_TEAM_MATCHES with, compares Y's win rate
   * *with* X to Y's win rate in all their OTHER matches (*without* X) --
   * only when that "without" sample itself has at least MIN_SOLO_MATCHES,
   * so a partner who has barely played anyone else can't produce a
   * meaningless swing either way. X's carry score is the average of that
   * lift across every qualifying partner: a consistently positive lift
   * means X's partners reliably do better with X than they otherwise do.
   * Purely a descriptive, for-fun stat -- like Best/Worst Teammate, it has
   * no bearing on Elo, RR, or rank.
   */
  computeCarries(matches: MatchSummary[], players: Player[]): CarryStat[] {
    const totalsByPlayer = new Map<string, { wins: number; losses: number }>();
    for (const player of players) totalsByPlayer.set(player.id, { wins: player.wins, losses: player.losses });

    const pairByKey = new Map<string, TeamPairStat>();
    for (const pair of this.computePairs(matches)) pairByKey.set(`${pair.playerLow}|${pair.playerHigh}`, pair);

    const results: CarryStat[] = [];
    for (const x of players) {
      let liftSum = 0, qualifyingPartners = 0, matchesTogether = 0;
      for (const y of players) {
        if (y.id === x.id) continue;
        const key = [x.id, y.id].sort().join('|');
        const pair = pairByKey.get(key);
        if (!pair || pair.matches < MIN_TEAM_MATCHES) continue;

        const yTotals = totalsByPlayer.get(y.id);
        if (!yTotals) continue;
        const yTotalMatches = yTotals.wins + yTotals.losses;
        const withoutMatches = yTotalMatches - pair.matches;
        if (withoutMatches < MIN_SOLO_MATCHES) continue;

        const winRateWithoutX = (yTotals.wins - pair.wins) / withoutMatches;
        liftSum += pair.winRate - winRateWithoutX;
        qualifyingPartners += 1;
        matchesTogether += pair.matches;
      }
      if (qualifyingPartners > 0) {
        results.push({ playerId: x.id, liftRate: liftSum / qualifyingPartners, partners: qualifyingPartners, matches: matchesTogether });
      }
    }
    return results;
  }

  /** The single player with the highest average lift -- deterministic tie-break: more qualifying partners, then more total matches, then player id. */
  theCarry(carries: CarryStat[]): CarryStat | null {
    return [...carries].sort((a, b) =>
      b.liftRate - a.liftRate ||
      b.partners - a.partners ||
      b.matches - a.matches ||
      a.playerId.localeCompare(b.playerId)
    )[0] ?? null;
  }
}
