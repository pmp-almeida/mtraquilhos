import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { SeasonService } from '../../core/services/season.service';
import { Season, PlayerSeasonStats } from '../../core/models/season';
import { RankState, RankDivision, RankTier } from '../../core/models/rank-state';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { I18nService } from '../../core/i18n/i18n.service';

interface LeaderboardRow {
  playerId: string;
  displayName: string;
  elo: number;
  rank: RankState;
  placementMatches: number;
  wins: number;
  losses: number;
}

const TIERS: RankTier[] = ['Champion', 'Emerald', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Iron', 'Lixo'];

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [FormsModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, RouterLink, RankBadgeComponent],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('leaderboard.eyebrow') }}</p>
      <h1>{{ i18n.t('leaderboard.title') }}</h1>
      <p>{{ i18n.t('leaderboard.subtitle') }}</p>
      <a routerLink="/how-it-works" class="how-link"><mat-icon aria-hidden="true">help_outline</mat-icon>{{ i18n.t('leaderboard.howLink') }}</a>
    </section>

    <div class="controls">
      @if (activeSeason()) {
        <mat-button-toggle-group [(ngModel)]="scope" [attr.aria-label]="i18n.t('leaderboard.scopeAriaLabel')">
          <mat-button-toggle value="season">{{ i18n.t('leaderboard.scopeSeason', { number: activeSeason()!.seasonNumber }) }}</mat-button-toggle>
          <mat-button-toggle value="allTime">{{ i18n.t('leaderboard.scopeAllTime') }}</mat-button-toggle>
        </mat-button-toggle-group>
      }
      <mat-form-field appearance="outline" class="tier-filter">
        <mat-label>{{ i18n.t('leaderboard.tierLabel') }}</mat-label>
        <mat-select [(ngModel)]="tierFilter">
          <mat-option value="all">{{ i18n.t('leaderboard.allTiers') }}</mat-option>
          <mat-option value="unranked">{{ i18n.t('leaderboard.unranked') }}</mat-option>
          @for (tier of tiers; track tier) { <mat-option [value]="tier">{{ tier }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="search">
        <mat-label>{{ i18n.t('leaderboard.searchLabel') }}</mat-label>
        <input matInput [(ngModel)]="search" [placeholder]="i18n.t('leaderboard.searchPlaceholder')" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>

    <mat-card>
      <mat-card-content>
        @if (error) { <p class="tf-error">{{ error }}</p> }
        @if (!filteredRows().length && !error) { <p class="tf-empty">{{ i18n.t('leaderboard.noMatches') }}</p> }
        @for (row of filteredRows(); track row.playerId; let i = $index) {
          <a class="row" [routerLink]="['/players', row.playerId]">
            <span class="position">{{ i + 1 }}</span>
            <span class="name">
              <strong>{{ row.displayName }}</strong>
              <app-rank-badge [rank]="row.rank" [placementMatches]="row.placementMatches" [compact]="true" />
            </span>
            <span class="record">{{ row.wins }}{{ i18n.t('common.winAbbr') }} – {{ row.losses }}{{ i18n.t('common.lossAbbr') }}</span>
          </a>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .heading { margin-bottom: 16px; }
    .how-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 0.85rem; font-weight: 600; color: var(--mat-sys-primary); text-decoration: none; }
    .how-link:hover { text-decoration: underline; }
    .how-link mat-icon { font-size: 18px; width: 18px; height: 18px; }
    h1 { margin: 8px 0; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
    .tier-filter { width: 160px; }
    .search { width: 220px; }
    .row { display: flex; align-items: center; gap: 16px; min-height: 56px; padding: 6px 4px; border-bottom: 1px solid var(--mat-sys-outline-variant); color: inherit; text-decoration: none; }
    .row:hover { background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent); }
    .position { width: 28px; color: var(--mat-sys-on-surface-variant); text-align: center; }
    .name { display: flex; align-items: center; gap: 10px; flex: 1; flex-wrap: wrap; }
    .record { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; min-width: 70px; text-align: right; }
  `]
})
export class LeaderboardComponent {
  private readonly playerService = inject(PlayerService);
  private readonly seasonService = inject(SeasonService);
  protected readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly activeSeason = signal<Season | null>(null);
  readonly seasonStats = signal<PlayerSeasonStats[]>([]);
  readonly names = signal<Record<string, string>>({});

  readonly tiers = TIERS;
  scope: 'season' | 'allTime' = 'allTime';
  tierFilter = 'all';
  search = '';
  error = '';

  readonly rows = computed<LeaderboardRow[]>(() => {
    if (this.scope === 'season' && this.activeSeason()) {
      const nameMap = this.names();
      return this.seasonStats()
        .map(stat => ({
          playerId: stat.playerId,
          displayName: nameMap[stat.playerId] ?? this.i18n.t('common.unknownPlayer'),
          elo: stat.currentElo,
          rank: this.parseRank(stat.finalRank, stat.finalRr),
          placementMatches: 0,
          wins: stat.wins,
          losses: stat.losses
        }))
        .sort((a, b) => b.elo - a.elo);
    }
    return this.players().map(p => ({
      playerId: p.id, displayName: p.displayName, elo: p.elo, rank: p.rank,
      placementMatches: p.placementMatches, wins: p.wins, losses: p.losses
    }));
  });

  /**
   * A plain method, not computed(): `search` and `tierFilter` are ordinary
   * component fields driven by [(ngModel)], not signals, so a computed()
   * here would never see them change (computed() only tracks *signal*
   * reads) and would stay stuck on whatever it first computed. As a plain
   * method it's called fresh on every change-detection pass, and the
   * ngModel bindings above already trigger CD on every keystroke/selection,
   * so this reflects the current search/filter immediately.
   */
  filteredRows(): LeaderboardRow[] {
    const query = this.search.trim().toLowerCase();
    return this.rows().filter(row => {
      if (query && !row.displayName.toLowerCase().includes(query)) return false;
      if (this.tierFilter === 'all') return true;
      if (this.tierFilter === 'unranked') return row.rank.tier === 'Unranked';
      return row.rank.tier === this.tierFilter;
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [players, activeSeason, names] = await Promise.all([
        this.playerService.listActive(),
        this.seasonService.getActive(),
        this.playerService.nameMap()
      ]);
      this.players.set(players);
      this.activeSeason.set(activeSeason);
      this.names.set(names);
      this.scope = activeSeason ? 'season' : 'allTime';
      if (activeSeason) {
        this.seasonStats.set(await this.seasonService.leaderboard(activeSeason.id));
      }
    } catch {
      this.error = this.i18n.t('leaderboard.loadError');
    }
  }

  private parseRank(label: string | null, rr: number | null): RankState {
    if (!label) return { tier: 'Unranked', division: null, rr: null };
    const [tier, division] = label.split(' ');
    return { tier: tier as RankTier | 'Unranked', division: (division ?? null) as RankDivision, rr };
  }
}
