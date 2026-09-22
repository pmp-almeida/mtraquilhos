import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RankBadgeComponent } from '../../shared/components/rank-badge/rank-badge.component';
import { RankState } from '../../core/models/rank-state';
import { RankService } from '../../rank/rank.service';
import { EloService } from '../../rank/elo.service';
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
 */
@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RankBadgeComponent],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">RANKING SYSTEM EXPLAINED</p>
      <h1>How ranking works</h1>
      <p>
        Everything the leaderboard, your profile, and match results show you &mdash; Elo, RR, tiers, placement
        matches, and the Demotion Shield &mdash; explained from scratch. No prior knowledge of competitive
        ranking systems required.
      </p>
      <nav class="jump-links" aria-label="Jump to section">
        <a href="#elo">Elo</a>
        <a href="#placements">Placement matches</a>
        <a href="#tiers">Tiers &amp; divisions</a>
        <a href="#rr">RR</a>
        <a href="#rankups">Rank-ups &amp; demotions</a>
        <a href="#shield">Demotion Shield</a>
        <a href="#special">Lixo &amp; Champion</a>
        <a href="#glossary">Glossary</a>
      </nav>
    </section>

    <mat-card id="elo" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">bar_chart</mat-icon>What is Elo?</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          Elo is a rating number that estimates how good a player is, relative to everyone else, based purely on
          who has beaten whom. It's the same style of system chess uses to rate players &mdash; win, and your number
          goes up; lose, and it goes down. Beat someone much better rated than you and it goes up by a lot; beat
          someone much worse rated than you and it goes up by only a little, because that result was expected.
        </p>
        <p>
          Every new player starts at <strong>{{ startingElo }} Elo</strong>. Because matches here are always
          2v2, a "team's Elo" for any given match is simply the average of its two players' current Elo:
        </p>
        <div class="formula">Team Elo = (Player 1 Elo + Player 2 Elo) / 2</div>
        <p>
          Before the match, that lets the system work out each team's <strong>expected win probability</strong> &mdash;
          how likely Team A is to win, purely based on the Elo gap between the two teams:
        </p>
        <div class="formula">Expected A = 1 / (1 + 10 ^ ((Team B Elo &minus; Team A Elo) / 400))</div>
        <p>
          After the match, the winning team gains Elo and the losing team loses the exact same amount &mdash; both
          teammates on a side always move by the same amount as each other. How much moves is controlled by a
          constant called the <strong>K-factor</strong>, currently <strong>{{ kFactor }}</strong>, scaled by how
          surprising the result was:
        </p>
        <div class="formula">Elo change = round({{ kFactor }} &times; (1 &minus; Expected win probability of the winning team))</div>
        <p class="example-label">Worked example</p>
        <div class="example">
          <p>
            Team A: a 500 Elo player and a 540 Elo player &rarr; team average <strong>{{ eloExample().teamAElo }}</strong><br />
            Team B: a 580 Elo player and a 620 Elo player &rarr; team average <strong>{{ eloExample().teamBElo }}</strong>
          </p>
          <p>
            Team A is the underdog here, so their expected win probability is only
            <strong>{{ (eloExample().expectedA * 100).toFixed(1) }}%</strong>. If Team A wins anyway, both of its
            players gain <strong>+{{ eloExample().deltaA }} Elo</strong>, and both Team B players lose the same
            <strong>{{ eloExample().deltaA }} Elo</strong>. If Team B had won instead &mdash; the expected outcome &mdash;
            they'd have gained only a modest amount, because beating a weaker team is worth less.
          </p>
        </div>
        <p>
          This is also why there's no separate "upset bonus" anywhere in the system: the Elo formula already makes
          upsets worth more and expected results worth less, automatically.
        </p>
        <p class="note">
          <mat-icon aria-hidden="true">info</mat-icon>
          The actual football score doesn't currently change your Elo at all &mdash; only who won does. Winning
          10&ndash;0 and winning 10&ndash;9 are treated exactly the same. The score is still saved with the match for
          the history and stats pages, it just isn't part of the rating math (yet &mdash; this is something that's
          been considered, see the project notes if you're curious about the trade-offs).
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="placements" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">flag</mat-icon>Placement matches</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          A brand-new player doesn't get a visible rank right away. They start <strong>Unranked</strong>, with a
          hidden Elo of {{ startingElo }}, and have to complete <strong>{{ placementMatchesRequired }} placement
          matches</strong> first. Placement matches use the exact same Elo math as every other match &mdash; there's
          no special multiplier &mdash; so a player's hidden Elo is already moving up or down with every result, you
          just can't see a rank for it yet.
        </p>
        <p>
          While a player is Unranked: no tier, no division, no RR, and no Demotion Shield are shown or processed.
          The player's profile instead shows their placement progress, e.g. "Unranked &middot; 3/{{ placementMatchesRequired }}".
          Those matches still fully count toward wins, losses, win rate, and teammate stats &mdash; they're real
          matches, just not yet rank-revealing ones.
        </p>
        <p>
          The moment the {{ placementMatchesRequired }}th placement match finishes, whatever Elo the player has
          accumulated by then is converted straight into their first visible rank and RR, using the exact same
          thresholds described below. There's no fixed starting rank like "everyone begins at Iron I" &mdash; two
          players can finish their placements with very different results depending entirely on how those
          {{ placementMatchesRequired }} matches went.
        </p>
        <div class="example">
          @for (row of placementExamples; track row.elo) {
            <div class="placement-row">
              <span>Final placement Elo <strong>{{ row.elo }}</strong> &rarr;</span>
              <app-rank-badge [rank]="row.state" [showRr]="true" />
            </div>
          }
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card id="tiers" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">military_tech</mat-icon>Tiers &amp; divisions</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          Once a player is ranked, their Elo maps onto one of 9 tiers. Every tier except Lixo (the bottom) and
          Champion (the very top) is split into three divisions &mdash; I, II, and III, each spanning
          {{ divisionWidth }} Elo points, with III as the highest division of that tier. Climbing the ladder looks
          like: Iron I &rarr; Iron II &rarr; Iron III &rarr; Bronze I &rarr; &hellip; all the way up to Emerald III,
          and then Champion.
        </p>
        <div class="tier-table">
          @for (row of tierTable; track row.state.tier + (row.state.division ?? '')) {
            <div class="tier-row">
              <app-rank-badge [rank]="row.state" [showRr]="false" />
              <span class="range">{{ row.floorLabel }} &ndash; {{ row.ceilingLabel }} Elo</span>
            </div>
          }
        </div>
        <p class="hint">
          This table is generated directly from the same thresholds the app uses to calculate every player's rank
          &mdash; it can't go out of date.
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="rr" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">speed</mat-icon>What is RR?</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          RR ("Rank Rating") shows how far a player has progressed <em>through</em> their current division, as a
          number from <strong>0 to 99</strong>. It's derived directly from Elo &mdash; it isn't tracked separately
          or won/lost on its own &mdash; so you never manage RR directly, it just reflects where your Elo currently
          sits inside its {{ divisionWidth }}-point division:
        </p>
        <div class="formula">RR = floor(((Elo &minus; division floor) / {{ divisionWidth }}) &times; 100)</div>
        <p>
          RR resets to 0 the instant Elo crosses into the next division (it never actually reaches 100 &mdash; the
          division changes first). Lixo and Champion don't show RR at all, since neither one has a division to
          progress through.
        </p>
        <div class="example rr-example">
          @for (row of rrExamples; track row.elo) {
            <div class="rr-row"><span>{{ row.elo }} Elo</span><span class="arrow">&rarr;</span><app-rank-badge [rank]="row.state" /></div>
          }
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card id="rankups" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">trending_up</mat-icon>Rank-ups (and demotions)</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          Rank-ups happen automatically the instant Elo crosses a division threshold &mdash; there's no separate
          "promotion match" to play. A player sitting at Iron I with 539 Elo who then gains a few points and
          crosses 540 is simply Iron II from that moment on.
        </p>
        <p>
          Demotions work the same way in reverse: if Elo drops below the floor of the current division, the rank
          drops with it &mdash; <em>unless</em> the player still has their Demotion Shield available, which changes
          what happens next (see below).
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="shield" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">shield</mat-icon>The Demotion Shield</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          Every ranked player gets a <strong>one-use Demotion Shield</strong>. It protects your <em>visible rank</em>,
          not your Elo &mdash; your underlying Elo always keeps moving normally with every match, win or lose, shield
          or no shield.
        </p>
        <p>
          The shield arms itself automatically the moment a match would otherwise push you out of your current
          rank &mdash; that is, your RR is at 0 and you're about to drop a division (or, for Champion, your Elo is
          about to fall back below {{ championFloor }}). Instead of demoting you immediately, the app keeps your
          rank and RR frozen right where they were and marks the next match as a <strong>demotion match</strong>:
        </p>
        <ul class="shield-outcomes">
          <li><strong>Win it</strong> &mdash; you keep your protected rank, and the shield is used up.</li>
          <li><strong>Lose it</strong> &mdash; you demote to wherever your Elo now lands, and the shield is used up.</li>
        </ul>
        <p>
          Either way, the shield only fires once. Once it's been used (won or lost), you won't get another one
          until&hellip; well, right now there's no way to earn a new one automatically once ranked &mdash; it's a
          single safety net, not a recurring one, for every rank all the way down to Lixo.
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="special" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">stars</mat-icon>Lixo &amp; Champion</mat-card-title></mat-card-header>
      <mat-card-content>
        <p>
          <strong>Lixo</strong> sits below Iron I, for anyone whose Elo drops under 500. It has no divisions and no
          RR &mdash; it's simply the floor of the ladder. There's no Demotion Shield below Lixo either, since there's
          nowhere lower to protect against.
        </p>
        <p>
          <strong>Champion</strong> is the opposite end: reached once Elo hits {{ championFloor }}, with no
          divisions above it and no RR (there's no next division to progress through). Champion players are simply
          ordered by raw Elo on the leaderboard. A Demotion Shield can still arm here too &mdash; it protects you
          from dropping back out of Champion into Emerald III the same way it protects any other rank floor.
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card id="glossary" class="section">
      <mat-card-header><mat-card-title><mat-icon aria-hidden="true">menu_book</mat-icon>Glossary</mat-card-title></mat-card-header>
      <mat-card-content>
        <div class="glossary">
          <div class="term"><dt>Elo</dt><dd>A number estimating a player's skill, based purely on who they've beaten. Goes up on a win, down on a loss, by more or less depending on how expected the result was.</dd></div>
          <div class="term"><dt>Peak Elo</dt><dd>The highest Elo a player has ever reached. It only ever goes up, even if their current Elo later drops.</dd></div>
          <div class="term"><dt>K-factor</dt><dd>The constant ({{ kFactor }}) that controls how big a single match's Elo swing can be.</dd></div>
          <div class="term"><dt>Expected win probability</dt><dd>How likely a team was to win a given match, purely from the Elo gap between the two teams, before it was played.</dd></div>
          <div class="term"><dt>RR (Rank Rating)</dt><dd>A 0&ndash;99 number showing progress through the current division. Derived from Elo, resets to 0 on every rank-up.</dd></div>
          <div class="term"><dt>Tier</dt><dd>One of the 9 named ranks: Lixo, Iron, Bronze, Silver, Gold, Platinum, Diamond, Emerald, Champion.</dd></div>
          <div class="term"><dt>Division</dt><dd>The I / II / III split within a tier (Lixo and Champion don't have divisions).</dd></div>
          <div class="term"><dt>Placement matches</dt><dd>The first {{ placementMatchesRequired }} matches a new player plays. They set the player's Elo, but no rank is shown until all {{ placementMatchesRequired }} are done.</dd></div>
          <div class="term"><dt>Demotion Shield</dt><dd>A one-use protection that freezes your rank instead of demoting you immediately, resolved by the result of your very next match.</dd></div>
          <div class="term"><dt>Demotion pending</dt><dd>The status shown while your Demotion Shield is armed and waiting on that next, rank-deciding match.</dd></div>
          <div class="term"><dt>Win streak</dt><dd>How many matches in a row a player has currently won (and, separately, the longest streak they've ever had).</dd></div>
          <div class="term"><dt>Best / Worst Teammate</dt><dd>Whichever teammate a player has the highest / lowest win rate alongside, counting only teammates they've played at least 5 matches with.</dd></div>
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

  readonly startingElo = STARTING_ELO;
  readonly kFactor = K_FACTOR;
  readonly placementMatchesRequired = PLACEMENT_MATCHES_REQUIRED;
  readonly divisionWidth = DIVISION_WIDTH;
  readonly championFloor = CHAMPION_FLOOR;

  readonly eloExample = computed(() => this.eloService.project([500, 540], [580, 620], 'A'));

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
