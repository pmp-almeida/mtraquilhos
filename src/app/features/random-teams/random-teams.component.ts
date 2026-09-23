import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { MatchService } from '../../core/services/match.service';
import { RandomTeamService, RandomTeams, TeamGenerationMode } from '../../core/services/random-team.service';
import { teamPairKey } from '../../core/models/team-name';
import { TeamNameService } from '../../core/services/team-name.service';
import { TeamStatsService, TeamPairStat, CarryStat } from '../../rank/team-stats.service';
import { EloService } from '../../rank/elo.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-random-teams',
  standalone: true,
  imports: [
    DecimalPipe, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatTooltipModule,
    RouterLink, RankBadgeComponent
  ],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('teams.eyebrow') }}</p>
      <h1>{{ i18n.t('teams.title') }}</h1>
      <p>{{ i18n.t('teams.subtitle') }}</p>
    </section>

    @if (!loading() && (bestTeams().length || theCarry() || dynamicDuo())) {
      <section class="records">
        <p class="tf-eyebrow">{{ i18n.t('teams.recordsEyebrow') }}</p>
        <div class="records-grid">
          <mat-card class="records-card">
            <mat-card-header><mat-card-title>{{ i18n.t('teams.bestTeamsTitle') }}</mat-card-title></mat-card-header>
            <mat-card-content>
              @if (!bestTeams().length) {
                <p class="tf-empty">{{ i18n.t('teams.bestTeamsEmpty') }}</p>
              } @else {
                @for (pair of bestTeams(); track pair.playerLow + pair.playerHigh; let i = $index) {
                  <div class="pair-row">
                    <span class="rank-num">{{ i + 1 }}</span>
                    <span class="pair-name">{{ pairLabel(pair) }}</span>
                    <span class="pair-matches">{{ i18n.tCount(pair.matches, 'playerProfile.matchesCount') }}</span>
                    <span class="pair-rate">{{ pct(pair.winRate) }}%</span>
                  </div>
                }
              }
              <p class="records-hint">{{ i18n.t('teams.minMatchesHint', { min: minTeamMatches }) }}</p>
            </mat-card-content>
          </mat-card>

          <div class="fact-cards">
            <mat-card class="fact-card">
              <mat-card-content>
                <span class="tf-eyebrow">{{ i18n.t('teams.carriesTitle') }}</span>
                @if (theCarry(); as carry) {
                  <strong class="fact-value">{{ nameOf(carry.playerId) }}</strong>
                  <span class="fact-sub">{{ i18n.t('teams.carriesValue', { lift: pct(carry.liftRate) }) }}</span>
                } @else {
                  <strong class="fact-value">{{ i18n.t('common.dash') }}</strong>
                  <span class="fact-sub">{{ i18n.t('teams.carriesEmpty') }}</span>
                }
                <mat-icon class="fact-info" [matTooltip]="i18n.t('teams.carriesHint')" aria-hidden="true">info_outline</mat-icon>
              </mat-card-content>
            </mat-card>

            <mat-card class="fact-card">
              <mat-card-content>
                <span class="tf-eyebrow">{{ i18n.t('teams.dynamicDuoTitle') }}</span>
                @if (dynamicDuo(); as duo) {
                  <strong class="fact-value">{{ pairLabel(duo) }}</strong>
                  <span class="fact-sub">{{ i18n.tCount(duo.matches, 'playerProfile.matchesCount') }} {{ i18n.t('teams.together') }}</span>
                } @else {
                  <strong class="fact-value">{{ i18n.t('common.dash') }}</strong>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      </section>
    }

    @if (error) { <p class="tf-error">{{ error }}</p> }
    @if (!loading() && players().length < 4) {
      <p class="tf-empty">{{ i18n.t('teams.needFourPre') }} <a routerLink="/players">{{ i18n.t('teams.addPlayers') }}</a>.</p>
    }

    <div class="generate-controls">
      <mat-button-toggle-group
        class="mode-toggle"
        [value]="mode()"
        (change)="mode.set($event.value)"
        [attr.aria-label]="i18n.t('teams.modeLabel')"
      >
        <mat-button-toggle value="random">
          <mat-icon aria-hidden="true">casino</mat-icon>
          {{ i18n.t('teams.modeRandom') }}
        </mat-button-toggle>
        <mat-button-toggle value="balanced">
          <mat-icon aria-hidden="true">balance</mat-icon>
          {{ i18n.t('teams.modeBalanced') }}
        </mat-button-toggle>
      </mat-button-toggle-group>

      <button mat-flat-button color="primary" (click)="generate()" [disabled]="players().length < 4">
        <mat-icon aria-hidden="true">shuffle</mat-icon>
        {{ teams() ? i18n.t('teams.shuffleAgain') : i18n.t('teams.generate') }}
      </button>
    </div>
    @if (mode() === 'balanced') { <p class="hint">{{ i18n.t('teams.modeBalancedHint') }}</p> }

    @if (teams(); as t) {
      <section class="teams">
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ i18n.t('teams.teamA') }}</mat-card-title>
            @if (namedTeam(t.teamA); as name) { <mat-card-subtitle>{{ i18n.t('teams.assumedTeamName', { name }) }}</mat-card-subtitle> }
          </mat-card-header>
          <mat-card-content>
            @for (p of t.teamA; track p.id) {
              <div class="player-row"><span>{{ p.displayName }}</span><app-rank-badge [rank]="p.rank" [placementMatches]="p.placementMatches" [compact]="true" [showRr]="false" /></div>
            }
          </mat-card-content>
        </mat-card>
        <div class="vs">
          <span class="prob">{{ (winProbability(t) * 100) | number:'1.0-1' }}%</span>
          <span class="prob-label">{{ i18n.t('teams.teamAWinChance') }}</span>
        </div>
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ i18n.t('teams.teamB') }}</mat-card-title>
            @if (namedTeam(t.teamB); as name) { <mat-card-subtitle>{{ i18n.t('teams.assumedTeamName', { name }) }}</mat-card-subtitle> }
          </mat-card-header>
          <mat-card-content>
            @for (p of t.teamB; track p.id) {
              <div class="player-row"><span>{{ p.displayName }}</span><app-rank-badge [rank]="p.rank" [placementMatches]="p.placementMatches" [compact]="true" [showRr]="false" /></div>
            }
          </mat-card-content>
        </mat-card>
      </section>
      <div class="post-actions">
        <a mat-flat-button color="primary" routerLink="/live" [state]="liveModeState(t)"><mat-icon aria-hidden="true">bolt</mat-icon>{{ i18n.t('live.startMatch') }}</a>
        <a mat-stroked-button routerLink="/matches/record"><mat-icon aria-hidden="true">add_circle</mat-icon>{{ i18n.t('teams.recordThisMatch') }}</a>
      </div>
    }
  `,
  styles: [`
    .heading { margin-bottom: 16px; max-width: 640px; }
    h1 { margin: 8px 0; }
    .records { margin-bottom: 24px; }
    .records-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; margin-top: 8px; }
    .records-card mat-card-content { padding-top: 4px; }
    .pair-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .rank-num { width: 18px; color: var(--mat-sys-on-surface-variant); font-weight: 700; font-size: 0.8rem; }
    .pair-name { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pair-matches { color: var(--mat-sys-on-surface-variant); font-size: 0.78rem; }
    .pair-rate { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 44px; text-align: right; }
    .records-hint { color: var(--mat-sys-on-surface-variant); font-size: 0.75rem; margin: 10px 0 0; }
    .fact-cards { display: flex; flex-direction: column; gap: 16px; }
    .fact-card mat-card-content { display: flex; flex-direction: column; gap: 2px; position: relative; }
    .fact-value { font-size: 1.3rem; }
    .fact-sub { color: var(--mat-sys-on-surface-variant); font-size: 0.8rem; }
    .fact-info { position: absolute; top: 0; right: 0; font-size: 18px; width: 18px; height: 18px; color: var(--mat-sys-on-surface-variant); cursor: help; }
    .generate-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 8px; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.8rem; margin: 8px 0 0; }
    .teams { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin-top: 20px; }
    .player-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .vs { text-align: center; }
    .prob { font-size: 1.8rem; font-weight: 700; display: block; }
    .prob-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); }
    .post-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    @media (max-width: 900px) { .records-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .teams { grid-template-columns: 1fr; } }
  `]
})
export class RandomTeamsComponent {
  private readonly playerService = inject(PlayerService);
  private readonly matchService = inject(MatchService);
  private readonly randomTeamService = inject(RandomTeamService);
  private readonly teamNameService = inject(TeamNameService);
  private readonly teamStatsService = inject(TeamStatsService);
  private readonly eloService = inject(EloService);
  protected readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly teams = signal<RandomTeams | null>(null);
  readonly loading = signal(true);
  readonly mode = signal<TeamGenerationMode>('random');
  readonly bestTeams = signal<TeamPairStat[]>([]);
  readonly theCarry = signal<CarryStat | null>(null);
  readonly dynamicDuo = signal<TeamPairStat | null>(null);
  readonly minTeamMatches = 5;
  private teamNameMap: Record<string, string> = {};
  private names: Record<string, string> = {};
  error = '';

  async ngOnInit(): Promise<void> {
    try {
      const [activePlayers, allPlayers, matches, teamNameMap, names] = await Promise.all([
        this.playerService.listActive(),
        this.playerService.listAll(),
        this.matchService.listAll(),
        this.teamNameService.nameMap(),
        this.playerService.nameMap()
      ]);
      this.players.set(activePlayers);
      this.teamNameMap = teamNameMap;
      this.names = names;

      const pairs = this.teamStatsService.computePairs(matches);
      this.bestTeams.set(this.teamStatsService.bestTeams(pairs, 5));
      this.dynamicDuo.set(this.teamStatsService.mostPlayedTogether(pairs));
      this.theCarry.set(this.teamStatsService.theCarry(this.teamStatsService.computeCarries(matches, allPlayers)));
    } catch {
      this.error = this.i18n.t('teams.loadError');
    } finally {
      this.loading.set(false);
    }
  }

  /** The custom team name for this generated pair, if one's been set -- purely a fun reveal, has no bearing on the shuffle. */
  namedTeam(pair: Player[]): string | null {
    if (pair.length !== 2) return null;
    return this.teamNameMap[teamPairKey(pair[0].id, pair[1].id)] ?? null;
  }

  /** Custom team name if set, otherwise "Player A & Player B" -- used for club-records pairs, which may include now-inactive players. */
  pairLabel(pair: TeamPairStat): string {
    const custom = this.teamNameMap[teamPairKey(pair.playerLow, pair.playerHigh)];
    if (custom) return custom;
    return `${this.nameOf(pair.playerLow)} & ${this.nameOf(pair.playerHigh)}`;
  }

  nameOf(id: string): string { return this.names[id] ?? this.i18n.t('common.unknownPlayer'); }
  pct(rate: number): number { return Math.round(rate * 1000) / 10; }

  generate(): void {
    try { this.teams.set(this.randomTeamService.generate(this.players(), this.mode())); }
    catch (error) { this.error = error instanceof Error ? error.message : this.i18n.t('teams.generateError'); }
  }

  liveModeState(t: RandomTeams): Record<string, string> {
    return {
      teamAPlayer1: t.teamA[0].id, teamAPlayer2: t.teamA[1].id,
      teamBPlayer1: t.teamB[0].id, teamBPlayer2: t.teamB[1].id
    };
  }

  winProbability(t: RandomTeams): number {
    return this.eloService.project([t.teamA[0].elo, t.teamA[1].elo], [t.teamB[0].elo, t.teamB[1].elo], 'A').expectedA;
  }
}
