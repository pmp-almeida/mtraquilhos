import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-card><mat-card-header><mat-card-title>Players</mat-card-title><mat-card-subtitle>New players start at 520 hidden Elo and complete five placements.</mat-card-subtitle></mat-card-header>
      <mat-card-content><div class="create"><mat-form-field appearance="outline"><mat-label>Player name</mat-label><input matInput [(ngModel)]="newName" /></mat-form-field><button mat-flat-button color="primary" (click)="create()" [disabled]="!newName.trim()">Add player</button></div>
      <p class="empty" *ngIf="players().length === 0">No active players yet.</p>
      @for (player of players(); track player.id) { <div class="player"><span>{{ player.displayName }}</span><span>Elo {{ player.elo }} · {{ player.rank.tier }}</span></div> }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`.create { display: flex; align-items: center; gap: 12px; margin-top: 20px; } .player { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); } .empty { color: var(--mat-sys-on-surface-variant); } @media (max-width: 540px) { .create { align-items: stretch; flex-direction: column; } }`]
})
export class PlayersComponent {
  private readonly playerService = inject(PlayerService);
  readonly players = signal<Player[]>([]);
  newName = '';

  async ngOnInit(): Promise<void> { this.players.set(await this.playerService.listActive()); }
  async create(): Promise<void> { const player = await this.playerService.create(this.newName); this.players.update(players => [...players, player]); this.newName = ''; }
}