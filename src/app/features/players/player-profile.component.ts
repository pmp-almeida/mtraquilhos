import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { SeasonService } from '../../core/services/season.service';
import { MatchSummary } from '../../core/models/match';
import { PlayerSeasonStats } from '../../core/models/season';
import { TeammateStatsService, TeammateStat } from '../../rank/teammate-stats.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-player-profile',
  standalone: true,
  imports: [DatePipe, RouterLink, MatCardModule, MatIconModule, RankBadgeComponent],
  template: `
    @if (loading()) {
      <p class="tf-empty">{{ i18n.t('playerProfile.loading') }}</p>
    } @else if (error) {
      <p class="tf-error">{{ error }}</p>
    } @else if (player(); as p) {
      <section class="header">
        <div>
          <p class="tf-eyebrow">{{ i18n.t('playerProfile.eyebrow') }}</p>
          <h1>{{ p.displayName }}</h1>
          <app-rank-badge [rank]="p.rank" [placementMatches]="p.placementMatches" />
        </div>
        <div class="elo-block">
          <span class="elo">{{ p.elo }}</span>
          <span class="elo-label">{{ i18n.t('playerProfile.currentEloPeak', { peak: p.peakElo }) }}</span>
        </div>
      </section>

      <section class="stats-grid">
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.wins') }}</span><strong>{{ p.wins }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.losses') }}</span><strong>{{ p.losses }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.winRate') }}</span><strong>{{ winRate() }}%</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.totalMatches') }}</span><strong>{{ p.wins + p.losses }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.currentStreak') }}</span><strong [class.tf-win]="currentStreak() > 0" [class.tf-loss]="currentStreak() < 0">{{ streakLabel(currentStreak()) }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.bestWinStreak') }}</span><strong>{{ bestWinStreak() }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.biggestGain') }}</span><strong class="tf-win">{{ biggestGain() !== null ? '+' + biggestGain() : i18n.t('common.dash') }}</strong></mat-card-content></mat-card>
        <mat-card><mat-card-content><span class="stat-label">{{ i18n.t('playerProfile.biggestLoss') }}</span><strong class="tf-loss">{{ biggestLoss() !== null ? biggestLoss() : i18n.t('common.dash') }}</strong></mat-card-content></mat-card>
      </section>

      <section class="split">
        <mat-card>
          <mat-card-header><mat-card-title>{{ i18n.t('playerProfile.teammatesTitle') }}</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="best-worst">
              <div><span class="stat-label">{{ i18n.t('playerProfile.bestTeammate') }}</span><strong>{{ bestTeammate() ? nameOf(bestTeammate()!.playerId) + ' — ' + pct(bestTeammate()!.winRate) + '%' : i18n.t('common.dash') }}</strong></div>
              <div><span class="stat-label">{{ i18n.t('playerProfile.worstTeammate') }}</span><strong>{{ worstTeammate() ? nameOf(worstTeammate()!.playerId) + ' — ' + pct(worstTeammate()!.winRate) + '%' : i18n.t('common.dash') }}</strong></div>
            </div>
            @if (!teammateStats().length) { <p class="tf-empty">{{ i18n.t('playerProfile.noMatches') }}</p> }
            @for (stat of teammateStats(); track stat.playerId) {
              <div class="teammate-row">
                <a [routerLink]="['/players', stat.playerId]">{{ nameOf(stat.playerId) }}</a>
                <span>{{ i18n.tCount(stat.matches, 'playerProfile.matchesCount') }}</span>
                <span>{{ stat.wins }}{{ i18n.t('common.winAbbr') }} – {{ stat.losses }}{{ i18n.t('common.lossAbbr') }}</span>
                <span class="win-rate">{{ pct(stat.winRate) }}%</span>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>{{ i18n.t('playerProfile.seasonHistoryTitle') }}</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (!seasonHistory().length) { <p class="tf-empty">{{ i18n.t('playerProfile.noSeasonHistory') }}</p> }
            @for (stat of seasonHistory(); track stat.seasonId) {
              <div class="season-row">
                <span>{{ stat.finalRank ?? i18n.t('leaderboard.unranked') }}{{ stat.finalRr !== null ? ' · ' + stat.finalRr + ' ' + i18n.t('common.rr') : '' }}</span>
                <span>{{ i18n.t('playerProfile.peak', { elo: stat.peakElo }) }}</span>
                <span>{{ stat.wins }}{{ i18n.t('common.winAbbr') }} – {{ stat.losses }}{{ i18n.t('common.lossAbbr') }}</span>
              </div>
            }
          </mat-card-content>
        </mat-card>
      </section>

      <mat-card class="matches-card">
        <mat-card-header><mat-card-title>{{ i18n.t('playerProfile.recentMatchesTitle') }}</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (!matches().length) { <p class="tf-empty">{{ i18n.t('playerProfile.noMatches') }}</p> }
          @for (match of matches().slice(0, 25); track match.id) {
            <div class="match-row">
              <mat-icon [class.tf-win]="wonMatch(match)" [class.tf-loss]="!wonMatch(match)">{{ wonMatch(match) ? 'trending_up' : 'trending_down' }}</mat-icon>
              <span>{{ match.playedAt | date:'medium':undefined:i18n.locale() }}</span>
              <span>{{ i18n.t('playerProfile.vsOpponents', { names: opponentNames(match) }) }}</span>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    :host { display: block; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
    h1 { margin: 4px 0 10px; }
    .elo-block { text-align: right; }
    .elo { font-size: 2.4rem; font-weight: 700; display: block; line-height: 1; }
    .elo-label { color: var(--mat-sys-on-surface-variant); font-size: 0.8rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat-label { display: block; color: var(--mat-sys-on-surface-variant); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stats-grid strong { font-size: 1.4rem; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .best-worst { display: flex; gap: 24px; margin-bottom: 12px; }
    .teammate-row, .season-row { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .teammate-row a { color: inherit; font-weight: 600; text-decoration: none; }
    .win-rate { font-variant-numeric: tabular-nums; font-weight: 600; }
    .match-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .match-row mat-icon { font-size: 20px; width: 20px; height: 20px; }
    @media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .split { grid-template-columns: 1fr; } }
  `]
})
export class PlayerProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly playerService = inject(PlayerService);
  private readonly matchService = inject(MatchService);
  private readonly seasonService = inject(SeasonService);
  private readonly teammateStatsService = inject(TeammateStatsService);
  protected readonly i18n = inject(I18nService);

  readonly player = signal<Player | null>(null);
  readonly matches = signal<MatchSummary[]>([]);
  readonly seasonHistory = signal<PlayerSeasonStats[]>([]);
  readonly eloDeltas = signal<number[]>([]);
  readonly names = signal<Record<string, string>>({});
  readonly loading = signal(true);
  error = '';
  private playerId = '';

  readonly winRate = computed(() => {
    const p = this.player();
    if (!p) return 0;
    const total = p.wins + p.losses;
    return total === 0 ? 0 : Math.round((p.wins / total) * 1000) / 10;
  });

  readonly teammateStats = computed<TeammateStat[]>(() => {
    if (!this.playerId) return [];
    return this.teammateStatsService.computeFromMatches(this.playerId, this.matches())
      .sort((a, b) => b.matches - a.matches);
  });
  readonly bestTeammate = computed(() => this.teammateStatsService.best(this.teammateStats()));
  readonly worstTeammate = computed(() => this.teammateStatsService.worst(this.teammateStats()));

  readonly currentStreak = computed(() => {
    // matches() is newest-first; walk forward until the result flips.
    let streak = 0;
    for (const match of this.matches()) {
      const won = this.wonMatch(match);
      if (streak === 0) { streak = won ? 1 : -1; continue; }
      if ((streak > 0) === won) streak += won ? 1 : -1; else break;
    }
    return streak;
  });

  readonly bestWinStreak = computed(() => {
    let best = 0, current = 0;
    // Walk oldest -> newest for a meaningful "best streak ever".
    for (const match of [...this.matches()].reverse()) {
      if (this.wonMatch(match)) { current += 1; best = Math.max(best, current); }
      else current = 0;
    }
    return best;
  });

  readonly biggestGain = computed(() => {
    const deltas = this.eloDeltas().filter(d => d > 0);
    return deltas.length ? Math.max(...deltas) : null;
  });
  readonly biggestLoss = computed(() => {
    const deltas = this.eloDeltas().filter(d => d < 0);
    return deltas.length ? Math.min(...deltas) : null;
  });

  async ngOnInit(): Promise<void> {
    this.playerId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.playerId) { this.error = this.i18n.t('playerProfile.noPlayerSpecified'); this.loading.set(false); return; }
    try {
      const [player, matches, names, seasonHistory, ratingEvents] = await Promise.all([
        this.playerService.getById(this.playerId),
        this.matchService.listForPlayer(this.playerId),
        this.playerService.nameMap(),
        this.seasonService.historyForPlayer(this.playerId),
        this.matchService.listRatingEvents(this.playerId)
      ]);
      if (!player) { this.error = this.i18n.t('playerProfile.notFound'); return; }
      this.player.set(player);
      this.matches.set(matches);
      this.names.set(names);
      this.seasonHistory.set(seasonHistory);
      this.eloDeltas.set(ratingEvents.map(e => e.eloDelta));
    } catch {
      this.error = this.i18n.t('playerProfile.loadError');
    } finally {
      this.loading.set(false);
    }
  }

  nameOf(id: string): string { return this.names()[id] ?? this.i18n.t('common.unknownPlayer'); }
  pct(rate: number): number { return Math.round(rate * 1000) / 10; }
  streakLabel(streak: number): string {
    if (streak === 0) return this.i18n.t('common.dash');
    return streak > 0 ? `${streak}${this.i18n.t('common.winAbbr')}` : `${Math.abs(streak)}${this.i18n.t('common.lossAbbr')}`;
  }

  wonMatch(match: MatchSummary): boolean {
    const onTeamA = match.teamAPlayerIds.includes(this.playerId);
    return (onTeamA && match.winner === 'A') || (!onTeamA && match.winner === 'B');
  }

  opponentNames(match: MatchSummary): string {
    const onTeamA = match.teamAPlayerIds.includes(this.playerId);
    const opponents = onTeamA ? match.teamBPlayerIds : match.teamAPlayerIds;
    return opponents.map(id => this.nameOf(id)).join(' & ');
  }
}
