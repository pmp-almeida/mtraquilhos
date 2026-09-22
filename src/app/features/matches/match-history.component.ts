import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatchSummary } from '../../core/models/match';
import { MatchService } from '../../core/services/match.service';
import { PlayerService } from '../../core/services/player.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-match-history',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatChipsModule],
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
  `]
})
export class MatchHistoryComponent {
  private readonly matchService = inject(MatchService);
  private readonly playerService = inject(PlayerService);
  protected readonly i18n = inject(I18nService);
  readonly matches = signal<MatchSummary[]>([]);
  private names: Record<string, string> = {};
  error = '';

  async ngOnInit(): Promise<void> {
    try {
      const [matches, names] = await Promise.all([this.matchService.listRecent(50), this.playerService.nameMap()]);
      this.matches.set(matches);
      this.names = names;
    } catch {
      this.error = this.i18n.t('matchHistory.loadError');
    }
  }

  teamNames(ids: [string, string]): string {
    return ids.map(id => this.names[id] ?? this.i18n.t('common.unknownPlayer')).join(' & ');
  }
}
