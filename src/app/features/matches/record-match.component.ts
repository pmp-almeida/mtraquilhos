import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatchService } from '../../core/services/match.service';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RecordMatchResult } from '../../core/models/match';
import { EloService } from '../../rank/elo.service';
import { RankService } from '../../rank/rank.service';

interface PlayerProjection {
  playerId: string;
  displayName: string;
  team: 'A' | 'B';
  eloBefore: number;
  eloAfter: number;
  delta: number;
  rankBeforeLabel: string;
}

@Component({
  selector: 'app-record-match',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatRadioModule, MatSelectModule, MatSnackBarModule
  ],
  template: `
    @if (result(); as res) {
      <mat-card class="result-card">
        <mat-card-header>
          <mat-card-title>Match recorded</mat-card-title>
          <mat-card-subtitle>Team {{ form.getRawValue().winner }} won &middot; expected win probability was {{ (res.expectedProbability * 100) | number:'1.0-1' }}%</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @for (p of res.players; track p.playerId) {
            <div class="result-row">
              <span class="name">{{ nameOf(p.playerId) }}</span>
              <span class="delta" [class.tf-win]="p.eloDelta > 0" [class.tf-loss]="p.eloDelta < 0">
                {{ p.eloDelta > 0 ? '+' : '' }}{{ p.eloDelta }} Elo
              </span>
              <span class="rank-change">
                {{ p.rankBefore }}
                @if (p.rankBefore !== p.rankAfter) { <mat-icon aria-hidden="true">arrow_right_alt</mat-icon> {{ p.rankAfter }} }
              </span>
              @if (!p.demotionShieldBefore && p.demotionShieldAfter) {
                <span class="badge shield"><mat-icon aria-hidden="true">shield</mat-icon>Demotion Shield armed</span>
              }
              @if (p.demotionShieldBefore && !p.demotionShieldAfter && p.rankAfter === p.rankBefore) {
                <span class="badge shield-saved"><mat-icon aria-hidden="true">verified</mat-icon>Shield saved the rank</span>
              }
              @if (p.demotionShieldBefore && !p.demotionShieldAfter && p.rankAfter !== p.rankBefore) {
                <span class="badge demoted"><mat-icon aria-hidden="true">trending_down</mat-icon>Demoted</span>
              }
            </div>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="reset()">Record another match</button>
        </mat-card-actions>
      </mat-card>
    } @else {
      <mat-card>
        <mat-card-header>
          <mat-card-title>Record a 2v2 match</mat-card-title>
          <mat-card-subtitle>Players and the winner are required; scores are optional.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="preview()">
            <div class="grid">
              @for (field of playerFields; track field) {
                <mat-form-field appearance="outline">
                  <mat-label>{{ labels[field] }}</mat-label>
                  <mat-select [formControlName]="field">
                    <mat-option value="">Select player</mat-option>
                    @for (player of players(); track player.id) { <mat-option [value]="player.id">{{ player.displayName }} ({{ player.elo }})</mat-option> }
                  </mat-select>
                </mat-form-field>
              }
              <mat-form-field appearance="outline"><mat-label>Score A</mat-label><input matInput type="number" formControlName="scoreA" min="0" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Score B</mat-label><input matInput type="number" formControlName="scoreB" min="0" /></mat-form-field>
            </div>
            <mat-radio-group formControlName="winner">
              <mat-radio-button value="A">Team A wins</mat-radio-button>
              <mat-radio-button value="B">Team B wins</mat-radio-button>
            </mat-radio-group>
            <div class="actions">
              <button mat-button type="button" (click)="clear()">Clear</button>
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">Preview match</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (projection(); as proj) {
        <mat-card class="preview-card">
          <mat-card-header><mat-card-title>Confirm before recording</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="teams">
              <div class="team">
                <h3>Team A &mdash; avg {{ proj.teamAElo | number:'1.0-1' }}</h3>
                @for (p of proj.players; track p.playerId) {
                  @if (p.team === 'A') { <div class="proj-row"><span>{{ p.displayName }}</span><span [class.tf-win]="p.delta > 0" [class.tf-loss]="p.delta < 0">{{ p.delta > 0 ? '+' : '' }}{{ p.delta }}</span></div> }
                }
              </div>
              <div class="vs">
                <span class="prob">{{ (proj.expectedA * 100) | number:'1.0-1' }}%</span>
                <span class="prob-label">Team A win chance</span>
              </div>
              <div class="team">
                <h3>Team B &mdash; avg {{ proj.teamBElo | number:'1.0-1' }}</h3>
                @for (p of proj.players; track p.playerId) {
                  @if (p.team === 'B') { <div class="proj-row"><span>{{ p.displayName }}</span><span [class.tf-win]="p.delta > 0" [class.tf-loss]="p.delta < 0">{{ p.delta > 0 ? '+' : '' }}{{ p.delta }}</span></div> }
                }
              </div>
            </div>
            <p class="disclaimer">Projected Elo change only. The server confirms the exact result, including any Demotion Shield or rank change.</p>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button type="button" (click)="cancelPreview()">Back</button>
            <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="confirm()">
              {{ saving() ? 'Recording…' : 'Confirm & record' }}
            </button>
          </mat-card-actions>
        </mat-card>
      }
    }
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
    mat-radio-button { margin: 12px 16px 12px 0; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }

    .preview-card { margin-top: 16px; }
    .teams { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: center; }
    .team h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .proj-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; }
    .vs { text-align: center; }
    .prob { font-size: 1.6rem; font-weight: 700; display: block; }
    .prob-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); }
    .disclaimer { color: var(--mat-sys-on-surface-variant); font-size: 0.8rem; margin-top: 16px; }
    @media (max-width: 640px) { .teams { grid-template-columns: 1fr; } }

    .result-card .result-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .result-row .name { font-weight: 600; min-width: 120px; }
    .result-row .delta { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 70px; }
    .rank-change { display: inline-flex; align-items: center; gap: 4px; color: var(--mat-sys-on-surface-variant); }
    .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; padding: 2px 8px; border-radius: 999px; }
    .badge mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .badge.shield { background: color-mix(in srgb, #5b8def 20%, transparent); color: #5b8def; }
    .badge.shield-saved { background: color-mix(in srgb, #3fbf6f 20%, transparent); color: #3fbf6f; }
    .badge.demoted { background: color-mix(in srgb, #e6533c 20%, transparent); color: #e6533c; }
  `]
})
export class RecordMatchComponent {
  private readonly fb = inject(FormBuilder);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly eloService = inject(EloService);
  private readonly rankService = inject(RankService);
  private readonly snackBar = inject(MatSnackBar);

  readonly playerFields = ['teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2'] as const;
  readonly labels: Record<string, string> = {
    teamAPlayer1: 'Team A player 1', teamAPlayer2: 'Team A player 2',
    teamBPlayer1: 'Team B player 1', teamBPlayer2: 'Team B player 2'
  };
  readonly players = signal<Player[]>([]);
  readonly form = this.fb.nonNullable.group({
    teamAPlayer1: ['', Validators.required], teamAPlayer2: ['', Validators.required],
    teamBPlayer1: ['', Validators.required], teamBPlayer2: ['', Validators.required],
    winner: ['A' as 'A' | 'B', Validators.required],
    scoreA: [null as number | null], scoreB: [null as number | null]
  });
  saving = signal(false);
  readonly projection = signal<{ teamAElo: number; teamBElo: number; expectedA: number; players: PlayerProjection[] } | null>(null);
  readonly result = signal<RecordMatchResult | null>(null);

  async ngOnInit(): Promise<void> {
    try { this.players.set(await this.playerService.listActive()); }
    catch { this.snackBar.open('Players could not be loaded.', 'Close', { duration: 4000 }); }
  }

  nameOf(playerId: string): string {
    return this.players().find(p => p.id === playerId)?.displayName ?? 'Unknown player';
  }

  preview(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const ids = [value.teamAPlayer1, value.teamAPlayer2, value.teamBPlayer1, value.teamBPlayer2];
    if (new Set(ids).size !== 4) { this.snackBar.open('Select four distinct players.', 'Close', { duration: 3000 }); return; }
    if ((value.scoreA === null) !== (value.scoreB === null) || (value.scoreA !== null && (value.scoreA < 0 || value.scoreB! < 0))) {
      this.snackBar.open('Enter both scores as non-negative numbers, or leave both blank.', 'Close', { duration: 3000 });
      return;
    }
    const byId = (id: string) => this.players().find(p => p.id === id)!;
    const a1 = byId(value.teamAPlayer1), a2 = byId(value.teamAPlayer2);
    const b1 = byId(value.teamBPlayer1), b2 = byId(value.teamBPlayer2);
    const proj = this.eloService.project([a1.elo, a2.elo], [b1.elo, b2.elo], value.winner);
    const build = (p: Player, team: 'A' | 'B', delta: number): PlayerProjection => ({
      playerId: p.id, displayName: p.displayName, team, eloBefore: p.elo, eloAfter: p.elo + delta, delta,
      rankBeforeLabel: this.rankService.label(p.rank)
    });
    this.projection.set({
      teamAElo: proj.teamAElo, teamBElo: proj.teamBElo, expectedA: proj.expectedA,
      players: [
        build(a1, 'A', proj.deltaA), build(a2, 'A', proj.deltaA),
        build(b1, 'B', proj.deltaB), build(b2, 'B', proj.deltaB)
      ]
    });
  }

  cancelPreview(): void {
    this.projection.set(null);
  }

  async confirm(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    try {
      const recorded = await this.matchService.record({
        teamAPlayer1: value.teamAPlayer1, teamAPlayer2: value.teamAPlayer2,
        teamBPlayer1: value.teamBPlayer1, teamBPlayer2: value.teamBPlayer2,
        winner: value.winner, scoreA: value.scoreA ?? undefined, scoreB: value.scoreB ?? undefined
      });
      this.result.set(recorded);
      this.projection.set(null);
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'Could not record match.', 'Close', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  clear(): void {
    this.form.reset({ winner: 'A' });
    this.projection.set(null);
  }

  reset(): void {
    this.result.set(null);
    this.clear();
    this.ngOnInit();
  }
}
