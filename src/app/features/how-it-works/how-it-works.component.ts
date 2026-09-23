import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { RankState } from '../../core/models/rank-state';
import { RankService } from '../../rank/rank.service';
import { EloService } from '../../rank/elo.service';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  CHAMPION_FLOOR,
  DIVISION_WIDTH,
  K_FACTOR,
  PLACEMENT_MATCHES_REQUIRED,
  RANK_THRESHOLDS,
  STARTING_ELO
} from '../../rank/rank.constants';

interface TierRow {
  state: RankState;
  floorLabel: string;
  ceilingLabel: string;
}

/**
 * A from-scratch explainer for the whole ranking system, aimed at someone
 * who has never seen Elo/RR/tier-based ranking before. Every worked number
 * on this page is computed live through RankService/EloService against the
 * real constants rather than hand-typed, so it can never drift out of sync
 * with what record_match actually does (the same discipline the spec
 * document itself follows -- see rank.constants.ts as the single source of
 * truth for every number quoted here).
 *
 * The in-page jump links use `routerLink="/how-it-works" [fragment]` rather
 * than a plain `href="/how-it-works#elo"`. A hardcoded absolute path like
 * that is resolved against the document's <base href>, which in production
 * is "/mtraquilhos/" (see the GitHub Pages deploy workflow's --base-href
 * flag) -- so "/how-it-works#elo" actually pointed at
 * "https://<user>.github.io/how-it-works", missing the repo segment
 * entirely: a 404 in production even though it looked fine in local dev.
 * Swapping in a bare `href="#elo"` doesn't fix it either -- a fragment-only
 * href is ALSO resolved against <base href>, not the current page's own
 * path, so clicking it would jump to "/mtraquilhos/#elo" (the dashboard
 * route) instead of staying put and scrolling. `routerLink` is base-href
 * aware, so the rendered href (and a plain new-tab/right-click open) is
 * always correct. A plain left click is then intercepted by `jumpTo()`,
 * which scrolls the target section into view directly and updates the URL
 * itself, instead of letting the click fall through to the Router: the
 * Router's own anchor scrolling (`withInMemoryScrolling` in app.config.ts,
 * still enabled for the fresh-page-load/deep-link case) turned out, when
 * verified by driving a real browser against a built copy of the app, to
 * race its own scroll-position-restoration and reset the scroll straight
 * back to the top for this same-route, fragment-only kind of navigation. A
 * modified click (ctrl/cmd/shift/middle-button) is left alone so "open in
 * new tab" still uses routerLink's own href normally.
 */
@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RouterLink, RankBadgeComponent],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('howItWorks.eyebrow') }}</p>
      <h1>{{ i18n.t('howItWorks.title') }}</h1>
      <p>{{ i18n.t('howItWorks.intro') }}</p>
      <nav class="jump-links" aria-label="Jump to section">
        <a routerLink="/how-it-works" fragment="elo" (click)="jumpTo($event, 'elo')">{{ i18n.t('howItWorks.jumpElo') }}</a>
        <a routerLink="/how-it-works" fragment="placements" (click)="jumpTo($event, 'placements')">{{ i18n.t('howItWorks.jumpPlacements') }}</a>
        <a routerLink="/how-it-works" fragment="tiers" (click)="jumpTo($event, 'tiers')">{{ i18n.t('howItWorks.jumpTiers') }}</a>
        <a routerLink="/how-it-works" fragment="rr" (click)="jumpTo($event, 'rr')">{{ i18n.t('howItWorks.jumpRr') }}</a>
        <a routerLink="/how-it-works" fragment="rankups" (click)="jumpTo($event, 'rankups')">{{ i18n.t('howItWorks.jumpRankups') }}</a>
        <a routerLink="/how-it-works" fragment="shield" (click)="jumpTo($event, 'shield')">{{ i18n.t('howItWorks.jumpShield') }}</a>
        <a routerLink="/how-it-works" fragment="special" (click)="jumpTo($event, 'special')">{{ i18n.t('howItWorks.jumpSpecial') }}</a>
        <a routerLink="/how-it-works" fragment="glossary" (click)="jumpTo($event, 'glossary')">{{ i18n.t('howItWorks.jumpGlossary') }}</a>
      </nav>
    </section>

    <mat-card id="elo" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">bar_chart</mat-icon>{{ i18n.t('howItWorks.eloSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.eloP1') }}</p>
        <p>{{ i18n.t('howItWorks.eloP2', { elo: startingElo }) }}</p>
        <div class="formula">{{ i18n.t('howItWorks.eloFormulaTeam') }}</div>
        <p>{{ i18n.t('howItWorks.eloP3') }}</p>
        <div class="formula">{{ i18n.t('howItWorks.eloFormulaExpected') }}</div>
        <p>{{ i18n.t('howItWorks.eloP4', { kFactor }) }}</p>
        <div class="formula">{{ i18n.t('howItWorks.eloFormulaDelta', { kFactor }) }}</div>
        <p class="example-label">{{ i18n.t('howItWorks.exampleLabel') }}</p>
        <div class="example">
          <p [innerHTML]="eloExampleTeamsHtml()"></p>
          <p>{{ i18n.t('howItWorks.eloExampleResult', { probability: (eloExample().expectedA * 100).toFixed(1), delta: eloExample().deltaA }) }}</p>
        </div>
        <p>{{ i18n.t('howItWorks.eloP5') }}</p>
        <p class="note">
          <mat-icon aria-hidden="true">info</mat-icon>
          {{ i18n.t('howItWorks.eloNote') }}
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="placements" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">flag</mat-icon>{{ i18n.t('howItWorks.placementsSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.placementsP1', { elo: startingElo, count: placementMatchesRequired }) }}</p>
        <p>{{ i18n.t('howItWorks.placementsP2', { count: placementMatchesRequired }) }}</p>
        <p>{{ i18n.t('howItWorks.placementsP3', { count: placementMatchesRequired }) }}</p>
        <div class="example">
          @for (row of placementExamples; track row.elo) {
            <div class="placement-row">
              <span>{{ i18n.t('howItWorks.placementExampleRow', { elo: row.elo }) }}</span>
              <app-rank-badge [rank]="row.state" [showRr]="true" />
            </div>
          }
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card id="tiers" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">military_tech</mat-icon>{{ i18n.t('howItWorks.tiersSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.tiersP1', { width: divisionWidth }) }}</p>
        <div class="tier-table">
          @for (row of tierTable; track row.state.tier + (row.state.division ?? '')) {
            <div class="tier-row">
              <app-rank-badge [rank]="row.state" [showRr]="false" />
              <span class="range">{{ i18n.t('howItWorks.eloRange', { floor: row.floorLabel, ceiling: row.ceilingLabel }) }}</span>
            </div>
          }
        </div>
        <p class="hint">{{ i18n.t('howItWorks.tiersHint') }}</p>
      </mat-card-content>
    </mat-card>

    <mat-card id="rr" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">speed</mat-icon>{{ i18n.t('howItWorks.rrSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.rrP1', { width: divisionWidth }) }}</p>
        <div class="formula">{{ i18n.t('howItWorks.rrFormula', { width: divisionWidth }) }}</div>
        <p>{{ i18n.t('howItWorks.rrP2') }}</p>
        <div class="example rr-example">
          @for (row of rrExamples; track row.elo) {
            <div class="rr-row"><span>{{ row.elo }} {{ i18n.t('common.elo') }}</span><span class="arrow">&rarr;</span><app-rank-badge [rank]="row.state" /></div>
          }
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card id="rankups" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">trending_up</mat-icon>{{ i18n.t('howItWorks.rankupsSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.rankupsP1') }}</p>
        <p>{{ i18n.t('howItWorks.rankupsP2') }}</p>
      </mat-card-content>
    </mat-card>

    <mat-card id="shield" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">shield</mat-icon>{{ i18n.t('howItWorks.shieldSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.shieldP1') }}</p>
        <p>{{ i18n.t('howItWorks.shieldP2', { championFloor }) }}</p>
        <ul class="shield-outcomes">
          <li>{{ i18n.t('howItWorks.shieldWin') }}</li>
          <li>{{ i18n.t('howItWorks.shieldLose') }}</li>
        </ul>
        <p>{{ i18n.t('howItWorks.shieldP3') }}</p>
      </mat-card-content>
    </mat-card>

    <mat-card id="special" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">stars</mat-icon>{{ i18n.t('howItWorks.specialSectionTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>{{ i18n.t('howItWorks.specialLixo') }}</p>
        <p>{{ i18n.t('howItWorks.specialChampion', { championFloor }) }}</p>
      </mat-card-content>
    </mat-card>

    <mat-card id="glossary" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">menu_book</mat-icon>{{ i18n.t('howItWorks.glossaryTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <div class="glossary">
          <div class="term"><dt>{{ i18n.t('howItWorks.termElo') }}</dt><dd>{{ i18n.t('howItWorks.glossaryElo') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termPeakElo') }}</dt><dd>{{ i18n.t('howItWorks.glossaryPeakElo') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termKFactor') }}</dt><dd>{{ i18n.t('howItWorks.glossaryKFactor', { kFactor }) }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termExpectedProbability') }}</dt><dd>{{ i18n.t('howItWorks.glossaryExpectedProbability') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termRr') }}</dt><dd>{{ i18n.t('howItWorks.glossaryRr') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termTier') }}</dt><dd>{{ i18n.t('howItWorks.glossaryTier') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termDivision') }}</dt><dd>{{ i18n.t('howItWorks.glossaryDivision') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termPlacements') }}</dt><dd>{{ i18n.t('howItWorks.glossaryPlacements', { count: placementMatchesRequired }) }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termShield') }}</dt><dd>{{ i18n.t('howItWorks.glossaryShield') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termPending') }}</dt><dd>{{ i18n.t('howItWorks.glossaryPending') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termStreak') }}</dt><dd>{{ i18n.t('howItWorks.glossaryStreak') }}</dd></div>
          <div class="term"><dt>{{ i18n.t('howItWorks.termTeammate') }}</dt><dd>{{ i18n.t('howItWorks.glossaryTeammate') }}</dd></div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .heading { margin-bottom: 20px; max-width: 760px; }
    .heading p { color: var(--mat-sys-on-surface-variant); }
    h1 { margin: 8px 0; }
    .jump-links { display: flex; flex-wrap: wrap; gap: 6px 4px; margin-top: 16px; }
    .jump-links a {
      font-size: 0.82rem; font-weight: 600; padding: 5px 12px; border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
      color: var(--mat-sys-primary); text-decoration: none;
    }
    .jump-links a:hover { background: color-mix(in srgb, var(--mat-sys-primary) 22%, transparent); }

    .section { max-width: 820px; margin-bottom: 16px; scroll-margin-top: 84px; }
    .section mat-card-title { display: flex; align-items: center; gap: 10px; }
    .section p { line-height: 1.6; }
    .section ul { line-height: 1.6; padding-left: 20px; }

    .formula {
      font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
      font-size: 0.88rem; background: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px;
      padding: 10px 14px; margin: 10px 0; overflow-x: auto;
    }
    .example-label { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); margin: 18px 0 4px; }
    .example {
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 10px; padding: 12px 16px;
      background: color-mix(in srgb, var(--mat-sys-tertiary) 6%, transparent);
    }
    .example p { margin: 6px 0; }

    .note {
      display: flex; gap: 8px; align-items: flex-start; margin-top: 16px;
      font-size: 0.85rem; color: var(--mat-sys-on-surface-variant);
      border-top: 1px solid var(--mat-sys-outline-variant); padding-top: 12px;
    }
    .note mat-icon { font-size: 18px; width: 18px; height: 18px; flex: none; margin-top: 1px; }

    .placement-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 0.9rem; }

    .tier-table { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .tier-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .range { font-variant-numeric: tabular-nums; color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }
    .hint { font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); margin-top: 12px; }

    .rr-example { display: flex; flex-direction: column; gap: 8px; }
    .rr-row { display: flex; align-items: center; gap: 10px; font-variant-numeric: tabular-nums; }
    .rr-row .arrow { color: var(--mat-sys-on-surface-variant); }

    .shield-outcomes li { margin: 4px 0; }

    .glossary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 28px; }
    .term dt { font-weight: 700; margin-bottom: 2px; }
    .term dd { margin: 0; color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; line-height: 1.5; }
    @media (max-width: 640px) { .glossary { grid-template-columns: 1fr; } }
  `]
})
export class HowItWorksComponent {
  private readonly rankService = inject(RankService);
  private readonly eloService = inject(EloService);
  protected readonly i18n = inject(I18nService);

  readonly startingElo = STARTING_ELO;
  readonly kFactor = K_FACTOR;
  readonly placementMatchesRequired = PLACEMENT_MATCHES_REQUIRED;
  readonly divisionWidth = DIVISION_WIDTH;
  readonly championFloor = CHAMPION_FLOOR;

  /**
   * See the class doc comment above for why this exists alongside
   * routerLink. Only takes over a plain left click -- a modified click
   * (ctrl/cmd/shift/middle-button, "open in new tab") is left alone so it
   * still opens routerLink's own correctly-computed href normally.
   */
  jumpTo(event: MouseEvent, id: string): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.pushState(null, '', `${location.pathname}#${id}`);
  }

  readonly eloExample = computed(() => this.eloService.project([500, 540], [580, 620], 'A'));

  /**
   * `howItWorks.eloExampleTeams` packs its two lines with a literal `\n`
   * (translation dictionaries can't embed HTML), so this renders it as a
   * two-line paragraph via a trusted, app-authored [innerHTML] binding --
   * the string never contains user input, only our own translated text.
   */
  readonly eloExampleTeamsHtml = computed(() => {
    const text = this.i18n.t('howItWorks.eloExampleTeams', {
      teamA: this.eloExample().teamAElo,
      teamB: this.eloExample().teamBElo
    });
    return text.replace(/\n/g, '<br />');
  });

  readonly placementExamples = [480, 520, 548, 1340].map(elo => ({
    elo,
    state: this.rankService.calculate(elo, PLACEMENT_MATCHES_REQUIRED)
  }));

  readonly rrExamples = [500, 510, 520, 530, 539, 540].map(elo => ({
    elo,
    state: this.rankService.calculate(elo, PLACEMENT_MATCHES_REQUIRED)
  }));

  readonly tierTable: TierRow[] = (() => {
    const rows: TierRow[] = [
      { state: { tier: 'Lixo', division: null, rr: null }, floorLabel: '0', ceilingLabel: '499' }
    ];
    RANK_THRESHOLDS.forEach((threshold, i) => {
      const next = RANK_THRESHOLDS[i + 1];
      const ceiling = next ? next.floor - 1 : CHAMPION_FLOOR - 1;
      rows.push({
        state: { tier: threshold.tier, division: threshold.division, rr: 0 },
        floorLabel: `${threshold.floor}`,
        ceilingLabel: `${ceiling}`
      });
    });
    rows.push({ state: { tier: 'Champion', division: null, rr: null }, floorLabel: `${CHAMPION_FLOOR}`, ceilingLabel: '+' });
    return rows;
  })();
}
