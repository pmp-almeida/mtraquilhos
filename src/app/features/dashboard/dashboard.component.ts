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
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, RouterLink, RankBadgeComponent],
  template: `
    <section class="hero">
      @if (activeSeason()) {
        <p class="tf-eyebrow">SEASON {{ activeSeason()!.seasonNumber }} · {{ activeSeason()!.name }}</p>
      } @else {
        <p class="tf-eyebrow">COMPETITIVE TABLE FOOTBALL</p>
      }
      <h1>Play. Rank up. Repeat.</h1>
      <p class="subtitle">Track Elo, ranks, placements, and every 2v2 match &mdash; Valorant-style tiers, RR, and Demotion Shields for a friendly office ladder.</p>
      <div class="hero-actions">
        <a mat-flat-button color="primary" routerLink="/matches/record"><mat-icon>add_circle</mat-icon>Record a match</a>
        <a mat-stroked-button routerLink="/teams"><mat-icon>shuffle</mat-icon>Generate teams</a>
        <a mat-button routerLink="/players"><mat-icon>group</mat-icon>Manage players</a>
      </div>
    </section>

    @if (error) { <p class="tf-error">{{ error }}</p> }

    <section class="cards">
      <mat-card><mat-card-header><mat-card-title>Players</mat-card-title></mat-card-header><mat-card-content><strong>{{ players().length }}</strong> active players</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Matches</mat-card-title></mat-card-header><mat-card-content><strong>{{ matchCount() }}</strong> recorded matches</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Average Elo</mat-card-title></mat-card-header><mat-card-content><strong>{{ averageElo() }}</strong> across active players</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Highest Elo</mat-card-title></mat-card-header><mat-card-content>
        @if (topByElo(); as p) { <strong>{{ p.elo }}</strong> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">&mdash;</span> }
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Most Wins</mat-card-title></mat-card-header><mat-card-content>
        @if (topByWins(); as p) { <strong>{{ p.wins }}</strong> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">&mdash;</span> }
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Highest Win Rate</mat-card-title></mat-card-header><mat-card-content>
        @if (topByWinRate(); as p) { <strong>{{ winRateOf(p) }}%</strong> &mdash; {{ p.displayName }} } @else { <span class="tf-empty">&mdash;</span> }
      </mat-card-content></mat-card>
    </section>

    <section class="split">
      <mat-card class="preview">
        <mat-card-header><mat-card-title>Leaderboard</mat-card-title><a mat-button routerLink="/leaderboard">View all</a></mat-card-header>
        <mat-card-content>
          @if (!players().length) { <p class="tf-empty">No active players yet.</p> }
          @for (player of players().slice(0, 5); track player.id; let i = $index) {
            <div class="row">
              <span class="position">{{ i + 1 }}</span>
              <a class="name" [routerLink]="['/players', player.id]">{{ player.displayName }}</a>
              <app-rank-badge [rank]="player.rank" [placementMatches]="player.placementMatches" [compact]="true" />
              <span class="elo">{{ player.elo }}</span>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="preview">
        <mat-card-header><mat-card-title>Recent matches</mat-card-title><a mat-button routerLink="/matches">View all</a></mat-card-header>
        <mat-card-content>
          @if (!matches().length) { <p class="tf-empty">No matches recorded yet.</p> }
          @for (match of matches().slice(0, 5); track match.id) {
            <div class="row">
              <span class="winner">Team {{ match.winner }}</span>
              <span class="date">{{ match.playedAt | date:'short' }}</span>
              <span class="score">{{ match.scoreA === null ? '&mdash;' : match.scoreA + ' – ' + match.scoreB }}</span>
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
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .preview mat-card-header { display: flex; align-items: center; justify-content: space-between; }
    .row { display: grid; grid-template-columns: 24px 1fr auto auto; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.9rem; }
    .position { color: var(--mat-sys-on-surface-variant); text-align: center; }
    .name { color: inherit; text-decoration: none; font-weight: 600; }
    .name:hover { text-decoration: underline; }
    .elo { font-variant-numeric: tabular-nums; font-weight: 600; }
    .winner { font-weight: 600; }
    .date, .score { color: var(--mat-sys-on-surface-variant); text-align: right; }
    @media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } .split { grid-template-columns: 1fr; } }
    @media (max-width: 540px) { .cards { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  private readonly playerService = inject(PlayerService);
  private readonly matchService = inject(MatchService);
  private readonly seasonService = inject(SeasonService);

  readonly players = signal<Player[]>([]);
  readonly matches = signal<MatchSummary[]>([]);
  readonly matchCount = signal(0);
  readonly activeSeason = signal<Season | null>(null);
  error = '';

  readonly averageElo = computed(() => {
    const list = this.players();
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, p) => sum + p.elo, 0) / list.length);
  });

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
      const [players, matches, matchCount, activeSeason] = await Promise.all([
        this.playerService.listActive(),
        this.matchService.listRecent(5),
        this.matchService.countAll(),
        this.seasonService.getActive()
      ]);
      this.players.set(players);
      this.matches.set(matches);
      this.matchCount.set(matchCount);
      this.activeSeason.set(activeSeason);
    } catch {
      this.error = 'Dashboard data could not be loaded. Check the Supabase configuration.';
    }
  }
}
