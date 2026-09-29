import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatchService } from '../../core/services/match.service';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { RandomTeamService, TeamGenerationMode } from '../../core/services/random-team.service';
import { teamPairKey } from '../../core/models/team-name';
import { TeamNameService } from '../../core/services/team-name.service';
import { RecordMatchResult } from '../../core/models/match';
import { EloService } from '../../rank/elo.service';
import { RankService } from '../../rank/rank.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/en-gb';

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
    ReactiveFormsModule, MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, MatSnackBarModule
  ],
  template: `
    @if (phase() === 'setup') {
      <mat-card class="setup-card">
        <mat-card-header>
          <mat-card-title>{{ i18n.t('live.title') }}</mat-card-title>
          <mat-card-subtitle>{{ i18n.t('live.setupSubtitle') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="random-row">
            <mat-button-toggle-group
              class="mode-toggle"
              [value]="randomMode()"
              (change)="randomMode.set($event.value)"
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
            <button mat-stroked-button type="button" [disabled]="players().length < 4" (click)="randomizeTeams()">
              <mat-icon aria-hidden="true">shuffle</mat-icon>
              {{ i18n.t('live.randomizeTeams') }}
            </button>
          </div>
          @if (randomMode() === 'balanced') { <p class="hint">{{ i18n.t('teams.modeBalancedHint') }}</p> }
          @if (players().length < 4) { <p class="hint">{{ i18n.t('teams.needFourPre') }}</p> }
          <p class="tf-eyebrow divider-label">{{ i18n.t('live.orPickManually') }}</p>
          <form [formGroup]="form">
            <div class="grid">
              @for (field of playerFields; track field) {
                <mat-form-field appearance="outline">
                  <mat-label>{{ i18n.t(labelKeys[field]) }}</mat-label>
                  <mat-select [formControlName]="field">
                    <mat-option value="">{{ i18n.t('recordMatch.selectPlayer') }}</mat-option>
                    @for (player of players(); track player.id) { <mat-option [value]="player.id">{{ player.displayName }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              }
            </div>
            <mat-form-field appearance="outline" class="target-field">
              <mat-label>{{ i18n.t('live.targetScoreLabel') }}</mat-label>
              <input matInput type="number" formControlName="targetScore" min="1" max="99" />
              <span matSuffix>&nbsp;{{ i18n.t('live.pointsSuffix') }}</span>
            </mat-form-field>
            <div class="actions">
              <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="start()">
                <mat-icon aria-hidden="true">bolt</mat-icon>
                {{ i18n.t('live.startMatch') }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="stage">
        <div class="top-bar">
          @if (!confirmingCancel()) {
            <button mat-icon-button (click)="confirmingCancel.set(true)" [attr.aria-label]="i18n.t('live.cancelAria')"><mat-icon>close</mat-icon></button>
          } @else {
            <div class="cancel-inline">
              <span>{{ i18n.t('live.discardPrompt') }}</span>
              <button mat-button (click)="confirmingCancel.set(false)">{{ i18n.t('live.no') }}</button>
              <button mat-button color="warn" (click)="cancel()">{{ i18n.t('live.discard') }}</button>
            </div>
          }
          <span class="target-chip">{{ i18n.t('live.targetChip', { target: targetScore() }) }}</span>
          <button mat-icon-button [disabled]="!history().length" (click)="undo()" [attr.aria-label]="i18n.t('live.undoAria')"><mat-icon>undo</mat-icon></button>
        </div>

        @if (result(); as res) {
          <div class="result-view">
            <mat-card class="result-card">
              <mat-card-header>
                <mat-card-title>{{ i18n.t('live.recordedTitle') }}</mat-card-title>
                <mat-card-subtitle>{{ i18n.t('live.recordedSubtitle', { scoreA: scoreA(), scoreB: scoreB(), team: res.winner }) }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                @for (p of res.players; track p.playerId) {
                  <div class="result-row">
                    <span class="name">{{ nameOf(p.playerId) }}</span>
                    <span class="rank-change">
                      {{ p.rankBefore }}{{ p.rrBefore !== null ? ' · ' + p.rrBefore + ' ' + i18n.t('common.rr') : '' }}
                      @if (p.rankBefore !== p.rankAfter || p.rrBefore !== p.rrAfter) {
                        <mat-icon aria-hidden="true">arrow_right_alt</mat-icon>
                        {{ p.rankAfter }}{{ p.rrAfter !== null ? ' · ' + p.rrAfter + ' ' + i18n.t('common.rr') : '' }}
                      }
                    </span>
                    @if (!p.demotionShieldBefore && p.demotionShieldAfter) {
                      <span class="badge shield"><mat-icon aria-hidden="true">shield</mat-icon>{{ i18n.t('recordMatch.shieldArmed') }}</span>
                    }
                    @if (p.demotionShieldBefore && !p.demotionShieldAfter && p.rankAfter === p.rankBefore) {
                      <span class="badge shield-saved"><mat-icon aria-hidden="true">verified</mat-icon>{{ i18n.t('recordMatch.shieldSaved') }}</span>
                    }
                    @if (p.demotionShieldBefore && !p.demotionShieldAfter && p.rankAfter !== p.rankBefore) {
                      <span class="badge demoted"><mat-icon aria-hidden="true">trending_down</mat-icon>{{ i18n.t('recordMatch.demoted') }}</span>
                    }
                  </div>
                }
              </mat-card-content>
              <mat-card-actions align="end">
                @if (canChainMatch()) {
                  <button mat-stroked-button (click)="startWithNewOpponents()">
                    <mat-icon aria-hidden="true">swap_horiz</mat-icon>
                    {{ i18n.t('live.nextChallengers') }}
                  </button>
                }
                <button mat-stroked-button (click)="startWithSamePlayers()">
                  <mat-icon aria-hidden="true">replay</mat-icon>
                  {{ i18n.t('live.samePlayers') }}
                </button>
                <button mat-flat-button color="primary" (click)="startAnother()">
                  <mat-icon aria-hidden="true">bolt</mat-icon>
                  {{ i18n.t('live.startAnother') }}
                </button>
              </mat-card-actions>
            </mat-card>
          </div>
          @if (nextOpponentsPrompt(); as nop) {
            <div class="finish-backdrop">
              <mat-card class="finish-sheet next-opponents-sheet">
                <mat-card-header><mat-card-title>{{ i18n.t('live.nextOpponentsTitle') }}</mat-card-title></mat-card-header>
                <mat-card-content>
                  @if (nop.streak) {
                    <p class="streak-note">{{ i18n.t('live.streakBody', { team: teamLabelFor(nop.winners[0], nop.winners[1]), count: nop.streak.count }) }}</p>
                    <mat-button-toggle-group
                      class="mode-toggle"
                      [value]="nop.splitWinners"
                      (change)="setSplitWinners($event.value)"
                      [attr.aria-label]="i18n.t('live.keepOrSplitLabel')"
                    >
                      <mat-button-toggle [value]="false">{{ i18n.t('live.streakKeep') }}</mat-button-toggle>
                      <mat-button-toggle [value]="true">{{ i18n.t('live.streakSwitch') }}</mat-button-toggle>
                    </mat-button-toggle-group>
                  }
                  <p class="tf-eyebrow divider-label">{{ i18n.t('live.pickChallengers') }}</p>
                  <div class="challenger-row">
                    <mat-form-field appearance="outline">
                      <mat-label>{{ i18n.t('live.challenger1') }}</mat-label>
                      <mat-select [value]="nop.challenger1" (selectionChange)="setChallenger(1, $event.value)">
                        @for (p of challengerOptions(nop, 1); track p.id) { <mat-option [value]="p.id">{{ p.displayName }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>{{ i18n.t('live.challenger2') }}</mat-label>
                      <mat-select [value]="nop.challenger2" (selectionChange)="setChallenger(2, $event.value)">
                        @for (p of challengerOptions(nop, 2); track p.id) { <mat-option [value]="p.id">{{ p.displayName }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                    <button
                      mat-icon-button type="button" (click)="shuffleChallengers()"
                      [attr.aria-label]="i18n.t('live.shuffleChallengers')"
                    ><mat-icon aria-hidden="true">shuffle</mat-icon></button>
                  </div>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-stroked-button type="button" (click)="cancelNextOpponents()">{{ i18n.t('common.cancel') }}</button>
                  <button mat-flat-button color="primary" type="button" (click)="confirmNextOpponents()">{{ i18n.t('live.startMatch') }}</button>
                </mat-card-actions>
              </mat-card>
            </div>
          }
        } @else {
          <div class="zones">
            <button type="button" class="zone team-a" (click)="addPoint('A')">
              <span class="score">{{ scoreA() }}</span>
              <span class="names">{{ teamALabel() }}</span>
            </button>
            <button type="button" class="zone team-b" (click)="addPoint('B')">
              <span class="score">{{ scoreB() }}</span>
              <span class="names">{{ teamBLabel() }}</span>
            </button>
          </div>

          @if (showFinishPrompt()) {
            <div class="finish-backdrop">
              <mat-card class="finish-sheet">
                <mat-card-header><mat-card-title>{{ i18n.t('live.finishTitle') }}</mat-card-title></mat-card-header>
                <mat-card-content>
                  <p class="final-score">{{ scoreA() }} – {{ scoreB() }}</p>
                  <p class="final-winner">{{ i18n.t('live.finishWinner', { team: leadingTeam() }) }}</p>
                  @if (finishProjection(); as proj) {
                    <div class="proj-rows">
                      @for (p of proj; track p.playerId) {
                        <div class="proj-row">
                          <span>{{ p.displayName }}</span>
                          <span class="proj-rank" [class.tf-win]="p.delta > 0" [class.tf-loss]="p.delta < 0">
                            {{ p.rankBeforeLabel }}{{ p.rrBefore !== null ? ' · ' + p.rrBefore + ' ' + i18n.t('common.rr') : '' }}
                            @if (p.changed) { <mat-icon aria-hidden="true">arrow_right_alt</mat-icon> {{ p.rankAfterLabel }}{{ p.rrAfter !== null ? ' · ' + p.rrAfter + ' ' + i18n.t('common.rr') : '' }} }
                          </span>
                        </div>
                      }
                    </div>
                    <p class="disclaimer">{{ i18n.t('live.finishDisclaimer') }}</p>
                  }
                </mat-card-content>
                <mat-card-actions>
                  <button mat-stroked-button type="button" (click)="keepPlaying()">{{ i18n.t('live.keepPlaying') }}</button>
                  <button mat-flat-button color="primary" type="button" [disabled]="submitting()" (click)="confirmFinish()">
                    {{ submitting() ? i18n.t('live.recording') : i18n.t('live.confirmAndFinish') }}
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
    .random-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 20px 0 4px; }
    .random-row button mat-icon { margin-right: 6px; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.8rem; margin: 4px 0; }
    .divider-label { margin: 16px 0 4px; }
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
    .next-opponents-sheet .streak-note{margin:0 0 12px}
    .next-opponents-sheet .mode-toggle{margin-bottom:16px}
    .next-opponents-sheet .divider-label{margin:0 0 8px}
    .challenger-row{display:flex;align-items:center;gap:8px}
    .challenger-row mat-form-field{flex:1;min-width:0}
    @media (max-width:480px){.challenger-row{flex-wrap:wrap}}

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
  private readonly teamNameService = inject(TeamNameService);
  private readonly randomTeamService = inject(RandomTeamService);
  private readonly eloService = inject(EloService);
  private readonly rankService = inject(RankService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  readonly playerFields = ['teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2'] as const;
  readonly labelKeys: Record<string, TranslationKey> = {
    teamAPlayer1: 'recordMatch.teamAPlayer1', teamAPlayer2: 'recordMatch.teamAPlayer2',
    teamBPlayer1: 'recordMatch.teamBPlayer1', teamBPlayer2: 'recordMatch.teamBPlayer2'
  };
  readonly form = this.fb.nonNullable.group({
    teamAPlayer1: ['', Validators.required], teamAPlayer2: ['', Validators.required],
    teamBPlayer1: ['', Validators.required], teamBPlayer2: ['', Validators.required],
    targetScore: [5, [Validators.required, Validators.min(1), Validators.max(99)]]
  });

  readonly players = signal<Player[]>([]);
  readonly teamNameMap = signal<Record<string, string>>({});
  readonly phase = signal<'setup' | 'live'>('setup');
  readonly confirmingCancel = signal(false);
  readonly submitting = signal(false);
  readonly result = signal<RecordMatchResult | null>(null);
  readonly randomMode = signal<TeamGenerationMode>('random');

  /**
   * Who's playing right now. This MUST be a signal, not a plain field: the
   * computed()s below (teamAName1..teamBName2, finishProjection) read it, and
   * a computed() only re-evaluates when a signal it read actually changes --
   * reading a plain object's properties inside a computed does not register
   * as a dependency. With a plain field here, start()/startAnother() calls
   * after the very first match update the object but the already-memoized
   * computed()s never noticed and kept showing the first match's players for
   * the rest of the component's lifetime, no matter what was picked in the
   * form -- the real cause of a run of live matches all getting attributed
   * to the original four players regardless of the new selection.
   */
  private readonly idsSignal = signal<{ a1: string; a2: string; b1: string; b2: string }>({ a1: '', a2: '', b1: '', b2: '' });
  readonly targetScore = signal(5);
  readonly scoreA = signal(0);
  readonly scoreB = signal(0);
  readonly history = signal<('A' | 'B')[]>([]);
  private startedAt = '';
  private dismissedForScore: string | null = null;
  private dismissTick = signal(0);

  /**
   * Tracks the current pair's win streak *as a duo*, purely in memory for
   * this visit to the live match screen -- not read from match history, so
   * it only ever reflects consecutive wins recorded right here in this
   * session's chain of matches. Reset implicitly: the moment a different
   * pair wins (or the streak team gets split up via "Switch it up"), the
   * next confirmed win no longer matches `key` and a fresh streak of 1
   * starts, no explicit reset code needed.
   */
  private winStreak: { key: string; count: number } | null = null;

  /**
   * The "Next opponents" picker shown by startWithNewOpponents, open for
   * as long as this is non-null. `winners`/`losers` are fixed for the
   * lifetime of one prompt; `challenger1`/`challenger2` and `splitWinners`
   * are edited in place by setChallenger/shuffleChallengers/
   * setSplitWinners as the player adjusts the suggestion, and
   * confirmNextOpponents reads the final state to actually start the
   * match. `streak` is only set when the winning duo has three or more
   * wins in a row, and gates whether the keep-together/split-them-up
   * toggle appears at all.
   */
  readonly nextOpponentsPrompt = signal<{
    winners: [string, string];
    losers: [string, string];
    streak: { count: number } | null;
    splitWinners: boolean;
    challenger1: string;
    challenger2: string;
  } | null>(null);

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
    const ids = this.idsSignal();
    const a1 = byId(ids.a1), a2 = byId(ids.a2), b1 = byId(ids.b1), b2 = byId(ids.b2);
    if (!a1 || !a2 || !b1 || !b2) return null;
    const winner = this.leadingTeam() as 'A' | 'B';
    const proj = this.eloService.project([a1.elo, a2.elo], [b1.elo, b2.elo], winner);
    const project = (p: Player, delta: number) => {
      const rankBefore = this.rankService.calculate(p.elo, p.placementMatches);
      const rankAfter = this.rankService.calculate(p.elo + delta, p.placementMatches + 1);
      const rankBeforeLabel = this.rankService.label(rankBefore);
      const rankAfterLabel = this.rankService.label(rankAfter);
      return {
        playerId: p.id, displayName: p.displayName, delta,
        rankBeforeLabel, rrBefore: rankBefore.rr,
        rankAfterLabel, rrAfter: rankAfter.rr,
        changed: rankBeforeLabel !== rankAfterLabel || rankBefore.rr !== rankAfter.rr
      };
    };
    return [
      project(a1, proj.deltaA),
      project(a2, proj.deltaA),
      project(b1, proj.deltaB),
      project(b2, proj.deltaB)
    ];
  });

  /** Custom team name for the current pair, if one's been set, otherwise "Player A & Player B" -- purely cosmetic, doesn't touch who's actually recorded. */
  readonly teamALabel = computed(() => {
    const ids = this.idsSignal();
    return this.teamLabelFor(ids.a1, ids.a2);
  });
  readonly teamBLabel = computed(() => {
    const ids = this.idsSignal();
    return this.teamLabelFor(ids.b1, ids.b2);
  });

  /**
   * "Winners stay" can always draw a new opposing pair: it prefers players
   * who weren't in the match that just finished, but if fewer than two of
   * those are around it tops up from the losing team (see
   * startWithNewOpponents) -- so the losers pool alone, which always has
   * exactly two players, guarantees a full pair no matter how small the
   * group is. The one real requirement is that a match just happened at
   * all, which already means at least four active players exist.
   */
  readonly canChainMatch = computed(() => this.players().length >= 4);

  async ngOnInit(): Promise<void> {
    try {
      const [players, teamNameMap] = await Promise.all([this.playerService.listActive(), this.teamNameService.nameMap()]);
      this.players.set(players);
      this.teamNameMap.set(teamNameMap);
    } catch {
      this.snackBar.open(this.i18n.t('live.playersLoadError'), this.i18n.t('common.close'), { duration: 4000 });
      return;
    }
    if (!this.prefillFromState()) {
      this.restore();
    }
  }

  /**
   * Generate Teams can hand off its generated matchup via router `state`
   * (see RandomTeamsComponent.liveModeState) so the player doesn't have to
   * re-pick all four players here. Only pre-fills the setup form -- the
   * player still confirms the target score and taps Start. A persisted
   * in-progress match (from `restore()`) always takes priority in practice
   * since `history.state` is only present right after that specific
   * navigation, but we still only fall back to `restore()` when there's no
   * valid incoming state.
   */
  private prefillFromState(): boolean {
    const state = history.state as Partial<Record<'teamAPlayer1' | 'teamAPlayer2' | 'teamBPlayer1' | 'teamBPlayer2', string>> | null;
    if (!state) return false;
    const ids = [state.teamAPlayer1, state.teamAPlayer2, state.teamBPlayer1, state.teamBPlayer2];
    if (ids.some(id => !id)) return false;
    const known = new Set(this.players().map(p => p.id));
    if (new Set(ids).size !== 4 || ids.some(id => !known.has(id!))) return false;
    this.form.patchValue({
      teamAPlayer1: state.teamAPlayer1, teamAPlayer2: state.teamAPlayer2,
      teamBPlayer1: state.teamBPlayer1, teamBPlayer2: state.teamBPlayer2
    });
    return true;
  }

  nameOf(playerId: string): string {
    return this.players().find(p => p.id === playerId)?.displayName ?? this.i18n.t('common.unknownPlayer');
  }

  teamLabelFor(idA: string, idB: string): string {
    const custom = this.teamNameMap()[teamPairKey(idA, idB)];
    return custom ?? `${this.nameOf(idA)} & ${this.nameOf(idB)}`;
  }

  /** Order-independent identity for a pair, used only for the in-memory win-streak check above (unrelated to teamPairKey, which is for the persisted custom-name lookup). */
  private pairKey(idA: string, idB: string): string {
    return [idA, idB].sort().join('|');
  }

  /** Resets the board and drops straight into a new live round with the given four players, same target score as before. Shared by every post-match shortcut (Next challengers, Same players, and the two streak-prompt choices) so they can't drift out of sync with each other. */
  private beginMatch(ids: { a1: string; a2: string; b1: string; b2: string }): void {
    this.idsSignal.set(ids);
    this.randomTeamService.recordPlayed([ids.a1, ids.a2, ids.b1, ids.b2]);
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

  /** Fills the four player selects with a fresh random (or balanced) matchup from active players -- same generator as Generate Teams, just inline so there's no page hop before Start. The player can still tweak any of the four selects afterwards. */
  randomizeTeams(): void {
    try {
      const teams = this.randomTeamService.generate(this.players(), this.randomMode());
      this.form.patchValue({
        teamAPlayer1: teams.teamA[0].id, teamAPlayer2: teams.teamA[1].id,
        teamBPlayer1: teams.teamB[0].id, teamBPlayer2: teams.teamB[1].id
      });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('teams.generateError'), this.i18n.t('common.close'), { duration: 4000 });
    }
  }

  start(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const ids = { a1: value.teamAPlayer1, a2: value.teamAPlayer2, b1: value.teamBPlayer1, b2: value.teamBPlayer2 };
    if (new Set(Object.values(ids)).size !== 4) { this.snackBar.open(this.i18n.t('live.selectFourDistinct'), this.i18n.t('common.close'), { duration: 3000 }); return; }
    this.targetScore.set(value.targetScore);
    this.beginMatch(ids);
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
      const ids = this.idsSignal();
      const recorded = await this.matchService.record({
        teamAPlayer1: ids.a1, teamAPlayer2: ids.a2,
        teamBPlayer1: ids.b1, teamBPlayer2: ids.b2,
        winner, scoreA: this.scoreA(), scoreB: this.scoreB(), note: 'Recorded via Live Mode'
      });
      this.result.set(recorded);
      const winnerIds = winner === 'A' ? [ids.a1, ids.a2] : [ids.b1, ids.b2];
      const key = this.pairKey(winnerIds[0], winnerIds[1]);
      this.winStreak = this.winStreak?.key === key ? { key, count: this.winStreak.count + 1 } : { key, count: 1 };
      this.clearPersisted();
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('live.recordError'), this.i18n.t('common.close'), { duration: 4000 });
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
    this.idsSignal.set({ a1: '', a2: '', b1: '', b2: '' });
    this.form.reset({ targetScore: 5 });
    this.phase.set('setup');
  }

  /**
   * "Winners stay": opens the Next opponents picker with a suggested pair
   * of challengers already filled in -- preferring whoever's active and
   * wasn't just involved in the match that finished, weighted by
   * RandomTeamService.pickFairly toward whoever's played the least this
   * session, and topped up from the team that just lost if there aren't
   * two such fresh players (small groups run out fast, and the losers
   * pool always has exactly two players, so a suggestion is always
   * possible even if it ends up being a rematch against part of the
   * losing side). If the winning duo is on a streak of three or more, the
   * picker also offers to split them across both new teams instead of
   * keeping them together -- see confirmNextOpponents, which reads
   * whatever the player finalised in the picker and actually starts the
   * match.
   */
  startWithNewOpponents(): void {
    const res = this.result();
    if (!res || !this.canChainMatch()) return;
    const ids = this.idsSignal();
    const winners: [string, string] = res.winner === 'A' ? [ids.a1, ids.a2] : [ids.b1, ids.b2];
    const losers: [string, string] = res.winner === 'A' ? [ids.b1, ids.b2] : [ids.a1, ids.a2];
    const [challenger1, challenger2] = this.suggestChallengers(winners, losers);

    const streak = this.winStreak;
    const onStreak = !!streak && streak.count >= 3 && streak.key === this.pairKey(winners[0], winners[1]);
    this.nextOpponentsPrompt.set({
      winners, losers, challenger1, challenger2,
      splitWinners: false,
      streak: onStreak ? { count: streak!.count } : null
    });
  }

  /** A fairness-weighted pair of challenger suggestions: prefers players who weren't in the match that just finished (see RandomTeamService.pickFairly), falling back to the losing team for whichever slot(s) that pool can't fill. Used both to fill the Next opponents picker initially and by its "shuffle" button. */
  private suggestChallengers(winners: [string, string], losers: [string, string]): [string, string] {
    const taken = new Set([...winners, ...losers]);
    const freshPlayers = this.players().filter(p => !taken.has(p.id));
    const fresh = this.randomTeamService.pickFairly(freshPlayers, 2).map(p => p.id);
    const backup = [...losers].sort(() => Math.random() - 0.5);
    const combined = [...fresh, ...backup];
    return [combined[0], combined[1]];
  }

  /** Options for one of the Next opponents picker's two challenger selects: every active player except the two winners (who can't challenge themselves) and whoever's currently picked in the *other* slot (so the two selects can never end up pointing at the same player). */
  challengerOptions(
    nop: { winners: [string, string]; challenger1: string; challenger2: string },
    slot: 1 | 2
  ): Player[] {
    const otherSlotValue = slot === 1 ? nop.challenger2 : nop.challenger1;
    const exclude = new Set([nop.winners[0], nop.winners[1], otherSlotValue]);
    return this.players().filter(p => !exclude.has(p.id));
  }

  setChallenger(slot: 1 | 2, playerId: string): void {
    this.nextOpponentsPrompt.update(nop => {
      if (!nop) return nop;
      return slot === 1 ? { ...nop, challenger1: playerId } : { ...nop, challenger2: playerId };
    });
  }

  setSplitWinners(splitWinners: boolean): void {
    this.nextOpponentsPrompt.update(nop => (nop ? { ...nop, splitWinners } : nop));
  }

  shuffleChallengers(): void {
    this.nextOpponentsPrompt.update(nop => {
      if (!nop) return nop;
      const [challenger1, challenger2] = this.suggestChallengers(nop.winners, nop.losers);
      return { ...nop, challenger1, challenger2 };
    });
  }

  cancelNextOpponents(): void {
    this.nextOpponentsPrompt.set(null);
  }

  /** Reads whatever the player finalised in the Next opponents picker -- their choice of challengers, and, when offered, whether to keep the winning duo together or split them across both teams -- and actually starts the match. */
  confirmNextOpponents(): void {
    const nop = this.nextOpponentsPrompt();
    if (!nop) return;
    this.nextOpponentsPrompt.set(null);
    const ids = nop.splitWinners
      ? { a1: nop.winners[0], a2: nop.challenger1, b1: nop.winners[1], b2: nop.challenger2 }
      : { a1: nop.winners[0], a2: nop.winners[1], b1: nop.challenger1, b2: nop.challenger2 };
    this.beginMatch(ids);
  }

  /**
   * Straight rematch: the exact same four players, same sides, same target
   * score -- for when that was simply a good match and everyone wants to
   * run it back rather than shuffling anyone in or out. Skips the setup
   * screen just like the other post-match shortcuts.
   */
  startWithSamePlayers(): void {
    if (!this.result()) return;
    this.beginMatch(this.idsSignal());
  }

  private persist(): void {
    if (this.phase() !== 'live' || this.result()) return;
    const ids = this.idsSignal();
    const payload: PersistedLiveMatch = {
      teamAPlayer1: ids.a1, teamAPlayer2: ids.a2,
      teamBPlayer1: ids.b1, teamBPlayer2: ids.b2,
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
      this.snackBar.open(this.i18n.t('live.discardedInactivePlayer'), this.i18n.t('common.close'), { duration: 6000 });
      return;
    }

    this.idsSignal.set({ a1: saved.teamAPlayer1, a2: saved.teamAPlayer2, b1: saved.teamBPlayer1, b2: saved.teamBPlayer2 });
    this.targetScore.set(saved.targetScore);
    this.scoreA.set(saved.scoreA);
    this.scoreB.set(saved.scoreB);
    this.history.set(saved.history);
    this.startedAt = saved.startedAt;
    this.phase.set('live');
    this.snackBar.open(this.i18n.t('live.resumed'), this.i18n.t('common.close'), { duration: 3000 });
  }
}
