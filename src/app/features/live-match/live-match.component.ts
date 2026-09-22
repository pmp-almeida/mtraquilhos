import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatchService } from '../../core/services/match.service';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RecordMatchResult } from '../../core/models/match';
import { EloService } from '../../rank/elo.service';

/**
 * A live match persisted to localStorage while it's in progress, so an
 * accidental refresh or a locked phone screen during physical play doesn't
 * lose a half-tracked score. Cleared the moment the match is confirmed
 * finished or explicitly discarded. This is purely a client-side
 * convenience -- nothing here is written to Supabase until the match is
 * confirmed, at which point it's the exact same `record_match` call the
 * regular Record Match screen makes.
 */
interface PersistedLiveMatch {
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  targetScore: number;
  scoreA: number;
  scoreB: number;
  history: ('A' | 'B')[];
  startedAt: string;
}

const STORAGE_KEY = 'tf-live-match-v1';

@Component({
  selector: 'app-live-match',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, MatSnackBarModule
  ],
  template: `
    @if (phase() === 'setup') {
      <mat-card class="setup-card">
        <mat-card-header>
          <mat-card-title>Live Match</mat-card-title>
          <mat-card-subtitle>Track the score right from the table. The result posts to the leaderboard the instant you confirm.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form">
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
            </div>
            <mat-form-field appearance="outline" class="target-field">
              <mat-label>First to</mat-label>
              <input matInput type="number" formControlName="targetScore" min="1" max="99" />
              <span matSuffix>&nbsp;points</span>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="start()">
                <mat-icon aria-hidden="true">bolt</mat-icon>
                Start live match
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="stage">
        <div class="top-bar">
          @if (!confirmingCancel()) {
            <button mat-icon-button (click)="confirmingCancel.set(true)" aria-label="Cancel match"><mat-icon>close</mat-icon></button>
          } @else {
            <div class="cancel-inline">
              <span>Discard this match?</span>
              <button mat-button (click)="confirmingCancel.set(false)">No</button>
              <button mat-button color="warn" (click)="cancel()">Discard</button>
            </div>
          }
          <span class="target-chip">First to {{ targetScore() }}</span>
          <button mat-icon-button [disabled]="!history().length" (click)="undo()" aria-label="Undo last point"><mat-icon>undo</mat-icon></button>
        </div>

        @if (result(); as res) {
          <div class="result-view">
            <mat-card class="result-card">
              <mat-card-header>
                <mat-card-title>Match recorded</mat-card-title>
                <mat-card-subtitle>Final score {{ scoreA() }} – {{ scoreB() }} &middot; Team {{ res.teamDelta >= 0 ? 'A' : 'B' }}&hellip; </mat-card-subtitle>
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
                <button mat-flat-button color="primary" (click)="startAnother()">
                  <mat-icon aria-hidden="true">bolt</mat-icon>
                  Start another live match
                </button>
              </mat-card-actions>
            </mat-card>
          </div>
        } @else {
          <div class="zones">
            <button type="button" class="zone team-a" (click)="addPoint('A')">
              <span class="score">{{ scoreA() }}</span>
              <span class="names">{{ teamAName1() }} &amp; {{ teamAName2() }}</span>
            </button>
            <button type="button" class="zone team-b" (click)="addPoint('B')">
              <span class="score">{{ scoreB() }}</span>
              <span class="names">{{ teamBName1() }} &amp; {{ teamBName2() }}</span>
            </button>
          </div>

          @if (showFinishPrompt()) {
            <div class="finish-backdrop">
              <mat-card class="finish-sheet">
                <mat-card-header><mat-card-title>Finish the match?</mat-card-title></mat-card-header>
                <mat-card-content>
                  <p class="final-score">{{ scoreA() }} – {{ scoreB() }}</p>
                  <p class="final-winner">Team {{ leadingTeam() }} wins</p>
                  @if (finishProjection(); as proj) {
                    <div class="proj-rows">
                      @for (p of proj; track p.playerId) {
                        <div class="proj-row">
                          <span>{{ p.displayName }}</span>
                          <span [class.tf-win]="p.delta > 0" [class.tf-loss]="p.delta < 0">{{ p.delta > 0 ? '+' : '' }}{{ p.delta }} Elo</span>
                        </div>
                      }
                    </div>
                    <p class="disclaimer">Projected Elo change only. The server confirms the exact result.</p>
                  }
                </mat-card-content>
                <mat-card-actions>
                  <button mat-stroked-button type="button" (click)="keepPlaying()">Keep playing</button>
                  <button mat-flat-button color="primary" type="button" [disabled]="submitting()" (click)="confirmFinish()">
                    {{ submitting() ? 'Recording…' : 'Confirm & finish' }}
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    .setup-card { max-width: 640px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
    .target-field { width: 160px; margin-top: 4px; }
    .actions { display: flex; justify-content: flex-end; margin-top: 12px; }
    .actions button mat-icon { margin-right: 6px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .actions { justify-content: stretch; } .actions button { width: 100%; } }

    .stage {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      background: var(--mat-sys-surface);
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: max(10px, env(safe-area-inset-top)) 8px 10px;
      flex: none;
      color: var(--mat-sys-on-surface);
    }
    .cancel-inline { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); }
    .target-chip { font-weight: 700; font-size: 0.8rem; letter-spacing: 0.04em; color: var(--mat-sys-on-surface-variant); text-transform: uppercase; }

    .zones { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .zone {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      color: #fff;
      transition: filter 0.12s ease, transform 0.08s ease;
      padding: 8px 12px;
      min-height: 0;
    }
    .zone:active { filter: brightness(1.2); }
    .zone .score {
      font-size: clamp(4.5rem, 24vw, 9.5rem);
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      transition: transform 0.12s ease;
    }
    .zone:active .score { transform: scale(0.94); }
    .zone .names { font-size: clamp(0.95rem, 3vw, 1.15rem); font-weight: 600; opacity: 0.92; margin-top: 6px; text-align: center; }
    .zone.team-a { background: linear-gradient(165deg, color-mix(in srgb, var(--mat-sys-tertiary) 60%, #000 40%) 0%, color-mix(in srgb, var(--mat-sys-tertiary) 32%, #000 68%) 100%); }
    .zone.team-b { background: linear-gradient(165deg, color-mix(in srgb, var(--mat-sys-primary) 60%, #000 40%) 0%, color-mix(in srgb, var(--mat-sys-primary) 32%, #000 68%) 100%); }

    .finish-backdrop {
      position: fixed; inset: 0; z-index: 1100;
      background: rgba(0, 0, 0, 0.62);
      display: flex; align-items: flex-end; justify-content: center;
    }
    .finish-sheet {
      width: 100%; max-width: 560px;
      border-radius: 20px 20px 0 0;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .final-score { font-size: 2.6rem; font-weight: 800; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
    .final-winner { color: var(--mat-sys-on-surface-variant); margin: 0 0 14px; }
    .proj-rows { display: flex; flex-direction: column; gap: 2px; }
    .proj-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .disclaimer { color: var(--mat-sys-on-surface-variant); font-size: 0.78rem; margin: 12px 0 0; }

    .result-view { flex: 1; overflow: auto; padding: 16px; }
    .result-card { max-width: 640px; margin: 0 auto; }
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
export class LiveMatchComponent {
  private readonly fb = inject(FormBuilder);
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly eloService = inject(EloService);
  private readonly snackBar = inject(MatSnackBar);

  readonly playerFields = ['teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2'] as const;
  readonly labels: Record<string, string> = {
    teamAPlayer1: 'Team A player 1', teamAPlayer2: 'Team A player 2',
    teamBPlayer1: 'Team B player 1', teamBPlayer2: 'Team B player 2'
  };
  readonly form = this.fb.nonNullable.group({
    teamAPlayer1: ['', Validators.required], teamAPlayer2: ['', Validators.required],
    teamBPlayer1: ['', Validators.required], teamBPlayer2: ['', Validators.required],
    targetScore: [10, [Validators.required, Validators.min(1), Validators.max(99)]]
  });

  readonly players = signal<Player[]>([]);
  readonly phase = signal<'setup' | 'live'>('setup');
  readonly confirmingCancel = signal(false);
  readonly submitting = signal(false);
  readonly result = signal<RecordMatchResult | null>(null);

  private ids: { a1: string; a2: string; b1: string; b2: string } = { a1: '', a2: '', b1: '', b2: '' };
  readonly targetScore = signal(10);
  readonly scoreA = signal(0);
  readonly scoreB = signal(0);
  readonly history = signal<('A' | 'B')[]>([]);
  private startedAt = '';
  private dismissedForScore: string | null = null;
  private dismissTick = signal(0);

  readonly leadingTeam = computed(() => (this.scoreA() > this.scoreB() ? 'A' : 'B'));

  readonly showFinishPrompt = computed(() => {
    this.dismissTick();
    const a = this.scoreA(), b = this.scoreB(), target = this.targetScore();
    const reached = (a >= target && a > b) || (b >= target && b > a);
    if (!reached) return false;
    return this.dismissedForScore !== `${a}-${b}`;
  });

  readonly finishProjection = computed(() => {
    if (!this.showFinishPrompt()) return null;
    const byId = (id: string) => this.players().find(p => p.id === id);
    const a1 = byId(this.ids.a1), a2 = byId(this.ids.a2), b1 = byId(this.ids.b1), b2 = byId(this.ids.b2);
    if (!a1 || !a2 || !b1 || !b2) return null;
    const winner = this.leadingTeam() as 'A' | 'B';
    const proj = this.eloService.project([a1.elo, a2.elo], [b1.elo, b2.elo], winner);
    return [
      { playerId: a1.id, displayName: a1.displayName, delta: proj.deltaA },
      { playerId: a2.id, displayName: a2.displayName, delta: proj.deltaA },
      { playerId: b1.id, displayName: b1.displayName, delta: proj.deltaB },
      { playerId: b2.id, displayName: b2.displayName, delta: proj.deltaB }
    ];
  });

  readonly teamAName1 = computed(() => this.nameOf(this.ids.a1));
  readonly teamAName2 = computed(() => this.nameOf(this.ids.a2));
  readonly teamBName1 = computed(() => this.nameOf(this.ids.b1));
  readonly teamBName2 = computed(() => this.nameOf(this.ids.b2));

  async ngOnInit(): Promise<void> {
    try {
      this.players.set(await this.playerService.listActive());
    } catch {
      this.snackBar.open('Players could not be loaded.', 'Close', { duration: 4000 });
      return;
    }
    this.restore();
  }

  nameOf(playerId: string): string {
    return this.players().find(p => p.id === playerId)?.displayName ?? 'Unknown player';
  }

  start(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const ids = [value.teamAPlayer1, value.teamAPlayer2, value.teamBPlayer1, value.teamBPlayer2];
    if (new Set(ids).size !== 4) { this.snackBar.open('Select four distinct players.', 'Close', { duration: 3000 }); return; }
    this.ids = { a1: value.teamAPlayer1, a2: value.teamAPlayer2, b1: value.teamBPlayer1, b2: value.teamBPlayer2 };
    this.targetScore.set(value.targetScore);
    this.scoreA.set(0);
    this.scoreB.set(0);
    this.history.set([]);
    this.dismissedForScore = null;
    this.startedAt = new Date().toISOString();
    this.result.set(null);
    this.confirmingCancel.set(false);
    this.phase.set('live');
    this.persist();
  }

  addPoint(team: 'A' | 'B'): void {
    if (this.confirmingCancel()) return;
    if (team === 'A') this.scoreA.update(v => v + 1); else this.scoreB.update(v => v + 1);
    this.history.update(h => [...h, team]);
    this.persist();
  }

  undo(): void {
    const h = this.history();
    if (!h.length) return;
    const last = h[h.length - 1];
    if (last === 'A') this.scoreA.update(v => Math.max(0, v - 1)); else this.scoreB.update(v => Math.max(0, v - 1));
    this.history.set(h.slice(0, -1));
    this.dismissedForScore = null;
    this.dismissTick.update(v => v + 1);
    this.persist();
  }

  keepPlaying(): void {
    this.dismissedForScore = `${this.scoreA()}-${this.scoreB()}`;
    this.dismissTick.update(v => v + 1);
  }

  async confirmFinish(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const winner = this.leadingTeam() as 'A' | 'B';
      const recorded = await this.matchService.record({
        teamAPlayer1: this.ids.a1, teamAPlayer2: this.ids.a2,
        teamBPlayer1: this.ids.b1, teamBPlayer2: this.ids.b2,
        winner, scoreA: this.scoreA(), scoreB: this.scoreB(), note: 'Recorded via Live Mode'
      });
      this.result.set(recorded);
      this.clearPersisted();
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'Could not record match.', 'Close', { duration: 4000 });
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.clearPersisted();
    this.confirmingCancel.set(false);
    this.phase.set('setup');
  }

  startAnother(): void {
    this.result.set(null);
    this.form.reset({ targetScore: 10 });
    this.phase.set('setup');
  }

  private persist(): void {
    if (this.phase() !== 'live' || this.result()) return;
    const payload: PersistedLiveMatch = {
      teamAPlayer1: this.ids.a1, teamAPlayer2: this.ids.a2,
      teamBPlayer1: this.ids.b1, teamBPlayer2: this.ids.b2,
      targetScore: this.targetScore(), scoreA: this.scoreA(), scoreB: this.scoreB(),
      history: this.history(), startedAt: this.startedAt
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* ignore: storage unavailable */ }
  }

  private clearPersisted(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  private restore(): void {
    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { return; }
    if (!raw) return;
    let saved: PersistedLiveMatch;
    try { saved = JSON.parse(raw); } catch { this.clearPersisted(); return; }

    const known = new Set(this.players().map(p => p.id));
    const wantedIds = [saved.teamAPlayer1, saved.teamAPlayer2, saved.teamBPlayer1, saved.teamBPlayer2];
    if (wantedIds.some(id => !known.has(id))) {
      this.clearPersisted();
      this.snackBar.open('Your in-progress live match involved a player who is no longer active, so it was discarded.', 'Close', { duration: 6000 });
      return;
    }

    this.ids = { a1: saved.teamAPlayer1, a2: saved.teamAPlayer2, b1: saved.teamBPlayer1, b2: saved.teamBPlayer2 };
    this.targetScore.set(saved.targetScore);
    this.scoreA.set(saved.scoreA);
    this.scoreB.set(saved.scoreB);
    this.history.set(saved.history);
    this.startedAt = saved.startedAt;
    this.phase.set('live');
    this.snackBar.open('Resumed your in-progress live match.', 'Close', { duration: 3000 });
  }
}
