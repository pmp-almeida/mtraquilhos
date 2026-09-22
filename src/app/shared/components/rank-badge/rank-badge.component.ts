import { Component, computed, inject, input } from '@angular/core';
import { RankState } from '../../../core/models/rank-state';
import { PLACEMENT_MATCHES_REQUIRED, RANK_COLORS } from '../../../rank/rank.constants';
import { I18nService } from '../../../core/i18n/i18n.service';

/**
 * Shared rank/tier badge used across the leaderboard, players list, player
 * profile, match history and the record-match preview so a player's rank is
 * always presented the same way: a colored dot + tier/division label, with
 * an optional RR readout, styled after competitive-shooter rank chips.
 */
@Component({
  selector: 'app-rank-badge',
  standalone: true,
  template: `
    <span class="rank-badge" [class.compact]="compact()" [style.--rank-color]="color()">
      <span class="dot" aria-hidden="true"></span>
      <span class="label">{{ label() }}</span>
      @if (showRr() && rank().rr !== null) {
        <span class="rr">{{ rank().rr }} {{ i18n.t('common.rr') }}</span>
      }
    </span>
  `,
  styles: [`
    .rank-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px 3px 6px; border-radius: 999px;
      background: color-mix(in srgb, var(--rank-color) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--rank-color) 45%, transparent);
      font-weight: 600; font-size: 0.85rem; line-height: 1.4; white-space: nowrap;
    }
    .dot {
      width: 9px; height: 9px; border-radius: 50%; background: var(--rank-color);
      box-shadow: 0 0 6px color-mix(in srgb, var(--rank-color) 80%, transparent);
      flex: none;
    }
    .label { color: var(--rank-color); }
    .rr { color: var(--mat-sys-on-surface-variant); font-weight: 500; font-variant-numeric: tabular-nums; }
    .compact { padding: 1px 8px 1px 5px; font-size: 0.72rem; gap: 4px; }
    .compact .dot { width: 7px; height: 7px; }
  `]
})
export class RankBadgeComponent {
  protected readonly i18n = inject(I18nService);

  readonly rank = input.required<RankState>();
  readonly placementMatches = input<number | null>(null);
  readonly showRr = input(true);
  readonly compact = input(false);

  readonly label = computed(() => {
    const state = this.rank();
    if (state.tier === 'Unranked') {
      const played = this.placementMatches();
      return played !== null
        ? this.i18n.t('common.unrankedProgress', { played, total: PLACEMENT_MATCHES_REQUIRED })
        : this.i18n.t('leaderboard.unranked');
    }
    return state.division ? `${state.tier} ${state.division}` : state.tier;
  });

  readonly color = computed(() => RANK_COLORS[this.rank().tier]);
}
