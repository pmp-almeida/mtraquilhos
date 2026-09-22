import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RandomTeamService, RandomTeams } from '../../core/services/random-team.service';
import { EloService } from '../../rank/elo.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-random-teams',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink, RankBadgeComponent],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('teams.eyebrow') }}</p>
      <h1>{{ i18n.t('teams.title') }}</h1>
      <p>{{ i18n.t('teams.subtitle') }}</p>
    </section>

    @if (error) { <p class="tf-error">{{ error }}</p> }
    @if (!loading() && players().length < 4) {
      <p class="tf-empty">{{ i18n.t('teams.needFourPre') }} <a routerLink="/players">{{ i18n.t('teams.addPlayers') }}</a>.</p>
    }

    <button mat-flat-button color="primary" (click)="generate()" [disabled]="players().length < 4">
      <mat-icon aria-hidden="true">shuffle</mat-icon>
      {{ teams() ? i18n.t('teams.shuffleAgain') : i18n.t('teams.generate') }}
    </button>

    @if (teams(); as t) {
      <section class="teams">
        <mat-card>
          <mat-card-header><mat-card-title>{{ i18n.t('teams.teamA') }}</mat-card-title><mat-card-subtitle>{{ i18n.t('teams.averageElo', { avg: (avgElo(t.teamA) | number:'1.0-1') }) }}</mat-card-subtitle></mat-card-header>
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
          <mat-card-header><mat-card-title>{{ i18n.t('teams.teamB') }}</mat-card-title><mat-card-subtitle>{{ i18n.t('teams.averageElo', { avg: (avgElo(t.teamB) | number:'1.0-1') }) }}</mat-card-subtitle></mat-card-header>
          <mat-card-content>
            @for (p of t.teamB; track p.id) {
              <div class="player-row"><span>{{ p.displayName }}</span><app-rank-badge [rank]="p.rank" [placementMatches]="p.placementMatches" [compact]="true" [showRr]="false" /></div>
            }
          </mat-card-content>
        </mat-card>
      </section>
      <a mat-stroked-button routerLink="/matches/record" class="record-link"><mat-icon>add_circle</mat-icon>{{ i18n.t('teams.recordThisMatch') }}</a>
    }
  `,
  styles: [`
    .heading { margin-bottom: 16px; max-width: 640px; }
    h1 { margin: 8px 0; }
    .teams { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; margin-top: 20px; }
    .player-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .vs { text-align: center; }
    .prob { font-size: 1.8rem; font-weight: 700; display: block; }
    .prob-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); }
    .record-link { margin-top: 16px; }
    @media (max-width: 720px) { .teams { grid-template-columns: 1fr; } }
  `]
})
export class RandomTeamsComponent {
  private readonly playerService = inject(PlayerService);
  private readonly randomTeamService = inject(RandomTeamService);
  private readonly eloService = inject(EloService);
  protected readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly teams = signal<RandomTeams | null>(null);
  readonly loading = signal(true);
  error = '';

  async ngOnInit(): Promise<void> {
    try { this.players.set(await this.playerService.listActive()); }
    catch { this.error = this.i18n.t('teams.loadError'); }
    finally { this.loading.set(false); }
  }

  generate(): void {
    try { this.teams.set(this.randomTeamService.generate(this.players())); }
    catch (error) { this.error = error instanceof Error ? error.message : this.i18n.t('teams.generateError'); }
  }

  avgElo(team: Player[]): number {
    return team.reduce((sum, p) => sum + p.elo, 0) / team.length;
  }

  winProbability(t: RandomTeams): number {
    return this.eloService.project([t.teamA[0].elo, t.teamA[1].elo], [t.teamB[0].elo, t.teamB[1].elo], 'A').expectedA;
  }
}
