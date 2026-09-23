import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatchSummary } from '../../core/models/match';
import { MatchService } from '../../core/services/match.service';
import { PlayerService } from '../../core/services/player.service';
import { teamPairKey } from '../../core/models/team-name';
import { TeamNameService } from '../../core/services/team-name.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-match-history',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('matchHistory.eyebrow') }}</p>
      <h1>{{ i18n.t('matchHistory.title') }}</h1>
      <p>{{ i18n.t('matchHistory.subtitle') }}</p>
    </section>
    <mat-card>
      <mat-card-content>
        @if (error) { <p class="tf-error">{{ error }}</p> }
        @if (!matches().length && !error) { <p class="tf-empty">{{ i18n.t('matchHistory.noMatches') }}</p> }
        @for (match of matches(); track match.id) {
          <div class="row">
            <div class="teams">
              <span class="team" [class.winner]="match.winner === 'A'">{{ teamNames(match.teamAPlayerIds) }}</span>
              <span class="vs">{{ i18n.t('common.vs') }}</span>
              <span class="team" [class.winner]="match.winner === 'B'">{{ teamNames(match.teamBPlayerIds) }}</span>
            </div>
            <div class="meta">
              <small>{{ match.playedAt | date:'medium':undefined:i18n.locale() }}</small>
              <span class="score">{{ match.scoreA === null ? i18n.t('matchHistory.scoreNotRecorded') : match.scoreA + ' – ' + match.scoreB }}</span>
            </div>
            <div class="rewind">
              @if (confirmingRewindId() === match.id) {
                <span class="confirm-prompt">{{ i18n.t('matchHistory.rewindPrompt') }}</span>
                <button mat-button (click)="confirmingRewindId.set(null)">{{ i18n.t('common.cancel') }}</button>
                <button mat-button color="warn" [disabled]="rewindingId() === match.id" (click)="rewind(match.id)">
                  {{ rewindingId() === match.id ? i18n.t('matchHistory.rewinding') : i18n.t('matchHistory.rewindConfirm') }}
                </button>
              } @else {
                <button mat-icon-button [attr.aria-label]="i18n.t('matchHistory.rewindAria')" [matTooltip]="i18n.t('matchHistory.rewindAria')" (click)="confirmingRewindId.set(match.id)">
                  <mat-icon aria-hidden="true">restore</mat-icon>
                </button>
              }
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .heading { margin-bottom: 24px; }
    h1 { margin: 8px 0; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); flex-wrap: wrap; }
    .teams { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .team.winner { color: var(--mat-sys-primary); }
    .vs { color: var(--mat-sys-on-surface-variant); font-weight: 400; font-size: 0.8rem; }
    .meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    small { color: var(--mat-sys-on-surface-variant); }
    .score { font-variant-numeric: tabular-nums; }
    .rewind { display: flex; align-items: center; gap: 4px; }
    .confirm-prompt { font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); max-width: 220px; }
  `]
})
export class MatchHistoryComponent {
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  private readonly teamNameService = inject(TeamNameService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);
  readonly matches = signal<MatchSummary[]>([]);
  readonly confirmingRewindId = signal<string | null>(null);
  readonly rewindingId = signal<string | null>(null);
  private names: Record<string, string> = {};
  private teamNameMap: Record<string, string> = {};
  error = '';

  async ngOnInit(): Promise<void> {
    try {
      const [matches, names, teamNameMap] = await Promise.all([
        this.matchService.listRecent(50), this.playerService.nameMap(), this.teamNameService.nameMap()
      ]);
      this.matches.set(matches);
      this.names = names;
      this.teamNameMap = teamNameMap;
    } catch {
      this.error = this.i18n.t('matchHistory.loadError');
    }
  }

  /** The pair's custom team name if one is set, otherwise "Player A & Player B" -- purely cosmetic, has no bearing on which players/Elo/RR the match actually involves. */
  teamNames(ids: [string, string]): string {
    const custom = this.teamNameMap[teamPairKey(ids[0], ids[1])];
    if (custom) return custom;
    return ids.map(id => this.names[id] ?? this.i18n.t('common.unknownPlayer')).join(' & ');
  }

  async rewind(matchId: string): Promise<void> {
    if (this.rewindingId()) return;
    this.rewindingId.set(matchId);
    try {
      await this.matchService.rewind(matchId);
      this.matches.update(list => list.filter(m => m.id !== matchId));
      this.confirmingRewindId.set(null);
      this.snackBar.open(this.i18n.t('matchHistory.rewindSuccess'), this.i18n.t('common.close'), { duration: 4000 });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('matchHistory.rewindError'), this.i18n.t('common.close'), { duration: 6000 });
    } finally {
      this.rewindingId.set(null);
    }
  }
}
