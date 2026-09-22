import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { PLACEMENT_MATCHES_REQUIRED } from '../../rank/rank.constants';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, RouterLink, RankBadgeComponent],
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
        <p class="empty" *ngIf="players().length === 0">{{ i18n.t('players.noActivePlayers') }}</p>
        @for (player of players(); track player.id) {
          <a class="player" [routerLink]="['/players', player.id]">
            <span>{{ player.displayName }}</span>
            <span class="right">
              <app-rank-badge [rank]="player.rank" [placementMatches]="player.placementMatches" [compact]="true" />
            </span>
          </a>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .create { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .player { display: flex; justify-content: space-between; align-items: center; padding: 14px 4px; border-bottom: 1px solid var(--mat-sys-outline-variant); color: inherit; text-decoration: none; }
    .player:hover { background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent); }
    .right { display: flex; align-items: center; gap: 10px; }
    .empty { color: var(--mat-sys-on-surface-variant); }
    .error { color: var(--mat-sys-error); }
    @media (max-width: 540px) { .create { align-items: stretch; flex-direction: column; } }
  `]
})
export class PlayersComponent {
  private readonly playerService = inject(PlayerService);
  protected readonly i18n = inject(I18nService);
  readonly placementMatchesRequired = PLACEMENT_MATCHES_REQUIRED;
  readonly players = signal<Player[]>([]);
  newName = '';
  error = '';

  async ngOnInit(): Promise<void> {
    try { this.players.set(await this.playerService.listActive()); }
    catch { this.error = this.i18n.t('players.loadError'); }
  }

  async create(): Promise<void> {
    this.error = '';
    try {
      const player = await this.playerService.create(this.newName);
      this.players.update(players => [...players, player].sort((a, b) => b.elo - a.elo));
      this.newName = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : this.i18n.t('players.createError');
    }
  }
}
