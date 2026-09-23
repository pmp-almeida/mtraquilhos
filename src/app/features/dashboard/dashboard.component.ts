import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { SeasonService } from '../../core/services/season.service';
import { Season } from '../../core/models/season';
import { MatchSummary } from '../../core/models/match';
import { teamPairKey } from '../../core/models/team-name';
import { TeamNameService } from '../../core/services/team-name.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink, RankBadgeComponent],
  template: `
    <section class="hero">
      @if (activeSeason(); as season) {
        <p class="tf-eyebrow">{{ i18n.t('dashboard.seasonEyebrow', { number: season.seasonNumber, name: season.name }) }}</p>
      } @else {
        <p class="tf-eyebrow">{{ i18n.t('dashboard.eyebrow') }}</p>
      }
      <h1>{{ i18n.t('dashboard.title') }}</h1>
      <p class="subtitle">{{ i18n.t('dashboard.subtitle') }}</p>
      <div class="hero-actions">
        <a mat-flat-button color="primary" routerLink="/live"><mat-icon>bolt</mat-icon>{{ i18n.t('dashboard.liveMatch') }}</a>
        <a mat-stroked-button routerLink="/matches/record"><mat-icon>add_circle</mat-icon>{{ i18n.t('dashboard.recordMatch') }}</a>
        <a mat-stroked-button routerLink="/teams"><mat-icon>shuffle</mat-icon>{{ i18n.t('dashboard.generateTeams') }}</a>
        <a mat-button routerLink="/players"><mat-icon>group</mat-icon>{{ i18n.t('dashboard.managePlayers') }}</a>
      </div>
    </section>

    @if (error) { <p class="tf-error">{{ error }}</p> }

    <section class="cards">
      <mat-card><mat-card-header><mat-card-title>{{ i18n.t('dashboard.cardPlayers') }}</mat-card-title></mat-card-header><mat-card-content><strong>{{ players().length }}</strong> {{ i18n.tCount(players().length, 'dashboard.cardPlayers') }}</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ i18n.t('dashboard.cardMatches') }}</mat-card-title></mat-card-header><mat-card-content><strong>{{ matchCount() }}</strong> {{ i18n.tCount(matchCount(), 'dashboard.cardMatches') }}</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ i18n.t('dashboard.cardTopRank') }}</mat-card-title></mat-card-header><mat-card-content class="top-rank-content">
        @if (topByElo(); as p) { <app-rank-badge [rank]="p.rank" [placementMatches]="p.placementMatches" /> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">{{ i18n.t('common.dash') }}</span> }
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ i18n.t('dashboard.cardMostWins') }}</mat-card-title></mat-card-header><mat-card-content>
        @if (topByWins(); as p) { <strong>{{ p.wins }}</strong> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">{{ i18n.t('common.dash') }}</span> }
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ i18n.t('dashboard.cardHighestWinRate') }}</mat-card-title></mat-card-header><mat-card-content>
        @if (topByWinRate(); as p) { <strong>{{ winRateOf(p) }}%</strong> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">{{ i18n.t('common.dash') }}</span> }
      </mat-card-content></mat-card>
    </section>

    <section class="split">
      <mat-card class="preview">
        <mat-card-header><mat-card-title>{{ i18n.t('dashboard.leaderboardTitle') }}</mat-card-title><a mat-button routerLink="/leaderboard">{{ i18n.t('dashboard.viewAll') }}</a></mat-card-header>
        <mat-card-content>
          @if (!players().length) { <p class="tf-empty">{{ i18n.t('dashboard.noActivePlayers') }}</p> }
          @for (player of players().slice(0, 5); track player.id; let i = $index) {
            <div class="row">
              <span class="position">{{ i + 1 }}</span>
              <a class="name" [routerLink]="['/players', player.id]">{{ player.displayName }}</a>
              <app-rank-badge [rank]="player.rank" [placementMatches]="player.placementMatches" [compact]="true" />
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="preview">
        <mat-card-header><mat-card-title>{{ i18n.t('dashboard.recentMatchesTitle') }}</mat-card-title><a mat-button routerLink="/matches">{{ i18n.t('dashboard.viewAll') }}</a></mat-card-header>
        <mat-card-content>
          @if (!matches().length) { <p class="tf-empty">{{ i18n.t('dashboard.noMatches') }}</p> }
          @for (match of matches().slice(0, 5); track match.id) {
            <div class="match-row">
              <div class="teams">
                <span class="team" [class.winner]="match.winner === 'A'">{{ teamNames(match.teamAPlayerIds) }}</span>
                <span class="vs">{{ i18n.t('common.vs') }}</span>
                <span class="team" [class.winner]="match.winner === 'B'">{{ teamNames(match.teamBPlayerIds) }}</span>
              </div>
              <div class="meta">
                <span class="date">{{ match.playedAt | date:'short':undefined:i18n.locale() }}</span>
                <span class="score">{{ match.scoreA === null ? i18n.t('common.dash') : match.scoreA + ' – ' + match.scoreB }}</span>
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [`
    .hero { padding: 40px 0 28px; max-width: 760px; }
    h1 { font-size: clamp(2.2rem, 6vw, 4rem); line-height: 1; margin: 10px 0; }
    .subtitle { font-size: 1.05rem; margin-bottom: 24px; color: var(--mat-sys-on-surface-variant); }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .hero-actions mat-icon { margin-right: 6px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .cards strong { font-size: 1.7rem; display: block; }
    .top-rank-content { display: flex; align-items: center; gap: 8px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .preview mat-card-header { display: flex; align-items: center; justify-content: space-between; }
    .row { display: grid; grid-template-columns: 24px 1fr auto auto; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .position { color: var(--mat-sys-on-surface-variant); text-align: center; }
    .name { color: inherit; text-decoration: none; font-weight: 600; }
    .name:hover { text-decoration: underline; }
    .elo { font-variant-numeric: tabular-nums; font-weight: 600; }
    .match-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .teams { display: flex; align-items: center; gap: 6px; font-weight: 600; flex-wrap: wrap; }
    .team.winner { color: var(--mat-sys-primary); }
    .vs { color: var(--mat-sys-on-surface-variant); font-weight: 400; font-size: 0.78rem; }
    .meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .date, .score { color: var(--mat-sys-on-surface-variant); text-align: right; }
    @media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } .split { grid-template-columns: 1fr; } }
    @media (max-width: 540px) { .cards { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  private readonly playerService = inject(PlayerService);
  private readonly matchService = inject(MatchService);
  private readonly seasonService = inject(SeasonService);
  private readonly teamNameService = inject(TeamNameService);
  protected readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly matches = signal<MatchSummary[]>([]);
  readonly matchCount = signal(0);
  readonly activeSeason = signal<Season | null>(null);
  private playerNames: Record<string, string> = {};
  private teamNameMap: Record<string, string> = {};
  error = '';

  readonly topByElo = computed(() => this.players().slice().sort((a, b) => b.elo - a.elo)[0] ?? null);
  readonly topByWins = computed(() => this.players().slice().sort((a, b) => b.wins - a.wins)[0] ?? null);
  readonly topByWinRate = computed(() => {
    const eligible = this.players().filter(p => p.wins + p.losses > 0);
    return eligible.sort((a, b) => this.winRateOf(b) - this.winRateOf(a))[0] ?? null;
  });

  winRateOf(player: Player): number {
    const total = player.wins + player.losses;
    return total === 0 ? 0 : Math.round((player.wins / total) * 1000) / 10;
  }

  async ngOnInit(): Promise<void> {
    try {
      const [players, matches, matchCount, activeSeason, playerNames, teamNameMap] = await Promise.all([
        this.playerService.listActive(),
        this.matchService.listRecent(5),
        this.matchService.countAll(),
        this.seasonService.getActive(),
        this.playerService.nameMap(),
        this.teamNameService.nameMap()
      ]);
      this.players.set(players);
      this.matches.set(matches);
      this.matchCount.set(matchCount);
      this.activeSeason.set(activeSeason);
      this.playerNames = playerNames;
      this.teamNameMap = teamNameMap;
    } catch {
      this.error = this.i18n.t('dashboard.loadError');
    }
  }

  teamNames(ids: [string, string]): string {
    const custom = this.teamNameMap[teamPairKey(ids[0], ids[1])];
    if (custom) return custom;
    return ids.map(id => this.playerNames[id] ?? this.i18n.t('common.unknownPlayer')).join(' & ');
  }
}
