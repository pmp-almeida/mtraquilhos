import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { PLACEMENT_MATCHES_REQUIRED } from '../../rank/rank.constants';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSnackBarModule, MatTooltipModule, RouterLink, RankBadgeComponent
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ i18n.t('players.title') }}</mat-card-title>
        <mat-card-subtitle>{{ i18n.t('players.subtitle', { count: placementMatchesRequired }) }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="create">
          <mat-form-field appearance="outline"><mat-label>{{ i18n.t('players.nameLabel') }}</mat-label><input matInput [(ngModel)]="newName" /></mat-form-field>
          <button mat-flat-button color="primary" (click)="create()" [disabled]="!newName.trim()">{{ i18n.t('players.addPlayer') }}</button>
        </div>
        @if (error) { <p class="error" role="alert">{{ error }}</p> }
        <p class="empty" *ngIf="activePlayers().length === 0 && inactivePlayers().length === 0">{{ i18n.t('players.noActivePlayers') }}</p>

        @for (player of activePlayers(); track player.id) {
          <div class="player">
            <a class="player-link" [routerLink]="['/players', player.id]">
              <span>{{ player.displayName }}</span>
              <app-rank-badge [rank]="player.rank" [placementMatches]="player.placementMatches" [compact]="true" />
            </a>
            <button mat-icon-button [disabled]="togglingId() === player.id"
              [attr.aria-label]="i18n.t('players.deactivateAria', { name: player.displayName })"
              [matTooltip]="i18n.t('players.deactivate')"
              (click)="toggleActive(player)">
              <mat-icon aria-hidden="true">pause_circle</mat-icon>
            </button>
          </div>
        }

        @if (inactivePlayers().length) {
          <h2 class="section-title">{{ i18n.t('players.inactiveSectionTitle') }}</h2>
          <p class="hint">{{ i18n.t('players.inactiveHint') }}</p>
          @for (player of inactivePlayers(); track player.id) {
            <div class="player inactive">
              <a class="player-link" [routerLink]="['/players', player.id]">
                <span>{{ player.displayName }}</span>
                <app-rank-badge [rank]="player.rank" [placementMatches]="player.placementMatches" [compact]="true" />
              </a>
              <button mat-icon-button [disabled]="togglingId() === player.id"
                [attr.aria-label]="i18n.t('players.activateAria', { name: player.displayName })"
                [matTooltip]="i18n.t('players.activate')"
                (click)="toggleActive(player)">
                <mat-icon aria-hidden="true">play_circle</mat-icon>
              </button>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .create { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .section-title { margin: 24px 0 2px; font-size: 0.95rem; color: var(--mat-sys-on-surface-variant); }
    .hint { margin: 0 0 8px; color: var(--mat-sys-on-surface-variant); font-size: 0.82rem; }
    .player { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .player.inactive { opacity: 0.6; }
    .player-link { flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 10px; min-width: 0; padding: 14px 4px; color: inherit; text-decoration: none; }
    .player-link:hover { color: var(--mat-sys-primary); }
    .empty { color: var(--mat-sys-on-surface-variant); }
    .error { color: var(--mat-sys-error); }
    @media (max-width: 540px) { .create { align-items: stretch; flex-direction: column; } }
  `]
})
export class PlayersComponent {
  private readonly playerService = inject(PlayerService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);
  readonly placementMatchesRequired = PLACEMENT_MATCHES_REQUIRED;
  readonly players = signal<Player[]>([]);
  readonly togglingId = signal<string | null>(null);
  readonly activePlayers = computed(() => this.players().filter(p => p.isActive));
  readonly inactivePlayers = computed(() => this.players().filter(p => !p.isActive));
  newName = '';
  error = '';

  async ngOnInit(): Promise<void> {
    try { this.players.set(await this.playerService.listAll()); }
    catch { this.error = this.i18n.t('players.loadError'); }
  }

  async create(): Promise<void> {
    this.error = '';
    try {
      const player = await this.playerService.create(this.newName);
      this.players.update(players =>
        [...players, player].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.elo - a.elo)
      );
      this.newName = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : this.i18n.t('players.createError');
    }
  }

  /** Toggles a player between active and inactive. Every active-player pool in the app (leaderboard, live match, random teams, record match) already filters on this flag, so this is the one control point for taking a player "on break" without losing their history. */
  async toggleActive(player: Player): Promise<void> {
    if (this.togglingId()) return;
    this.togglingId.set(player.id);
    const next = !player.isActive;
    try {
      await this.playerService.setActive(player.id, next);
      this.players.update(list => list.map(p => (p.id === player.id ? { ...p, isActive: next } : p)));
      this.snackBar.open(
        this.i18n.t(next ? 'players.activateSuccess' : 'players.deactivateSuccess', { name: player.displayName }),
        this.i18n.t('common.close'),
        { duration: 4000 }
      );
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('players.toggleError'), this.i18n.t('common.close'), { duration: 5000 });
    } finally {
      this.togglingId.set(null);
    }
  }
}
