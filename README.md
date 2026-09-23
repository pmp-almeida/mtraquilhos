# MTraquilhos

Table Football Ranked ("MTraquilhos") is a ranked-ladder tracker for
friendly 2v2 table-football matches. It runs Elo ratings, placement
matches, competitive tiers with automatic promotion/demotion, and a
one-use Demotion Shield, then layers on leaderboards, per-player
statistics, club-wide "records," a live scoreboard, and a random/balanced
team generator -- all in a bilingual, installable, light/dark-themed web
app with no sign-up.

## Purpose

This is an internal recreational tool for the Multicert mTrust
development team. It remains a standalone application: it does not
integrate with mTrust services, repositories, authentication, or
production data.

The Angular frontend is hosted as a static site (GitHub Pages) and uses
Supabase for the application database and authoritative match
processing -- all rating math happens server-side in `SECURITY DEFINER`
Postgres functions, never trusted from the browser. There is no
authentication or per-user identity; see "No-auth model" below and
`docs/no-auth-deployment.md` and `docs/git-and-supabase-setup.md` before
sharing or deploying an instance.

## Feature overview

**Ranking**
- Individual Elo ratings with 10 placement matches before a player's
  first rank is revealed.
- Nine named tiers -- Lixo, Iron, Bronze, Silver, Gold, Platinum,
  Diamond, Emerald, Champion -- with Iron through Emerald split into
  I/II/III divisions and a 0-99 RR progression within each.
- Automatic rank-ups and demotions driven purely by Elo crossing a
  division floor.
- A one-use **Demotion Shield** that protects every rank without
  exception (Champion included) the instant a player would otherwise
  drop, resolved by the result of their very next match. See
  `table-football-ranked-app-spec-v2.md` for the exact rules.
- Optional **Seasons**: a Valorant-Act-style soft reset that compresses
  every active player's Elo toward the group average instead of wiping
  it, without touching lifetime stats or match history.

**Playing and recording matches**
- **Live Match**: score a match live from one shared device at the
  table, with a running scoreboard, a live-projected Elo/rank change,
  and a "winners stay" flow to line up the next challengers instantly.
  In-progress matches survive an accidental refresh or a locked screen.
  The setup screen can generate a random or balanced 2v2 matchup inline
  (see Team generation below) instead of picking all four players by
  hand.
- **Record Match**: a non-live flow for entering a final score after the
  fact, with the same projected-outcome preview and a post-match result
  summary. Recorded matches can be rewound/undone.
- **Team generation** (`/teams`): split active players into two 2v2
  teams, either purely at random or in **balanced mode**, which keeps
  the same four players but pairs them to minimize the Elo gap between
  the two teams. One tap sends the result straight into Live Match or
  Record Match.
- **Club records**: a small leaderboard of the best-performing pairs by
  win rate, a "Dynamic Duo" (most-played-together pair), and "The One
  Who Carries" -- the player whose regular partners consistently win
  more often with them on their team than without.
- **Custom team names** (`/team-names`): give any pair of players a
  persistent, cosmetic nickname. It shows up everywhere that exact pair
  appears together (match history, dashboard, live match, generated
  teams, a player's own match list) and can be assigned directly from
  the Club records leaderboard via a one-tap "name this duo" link.

**Players and stats**
- Player management: create, rename, and activate/deactivate players
  (inactive players are excluded from team generation but keep their
  history and stats).
- Leaderboard and full match history.
- Player profiles: current rank and RR, win/loss record, current and
  longest win streaks, peak Elo, season history, Best/Worst Teammate,
  and Head-to-head records against specific opponents.

**App experience**
- Bilingual UI -- English (en-GB) and European Portuguese (pt-PT),
  switchable at runtime with no rebuild.
- Light and dark theme, switchable at runtime, defaulting to the
  system's preference.
- Installable as a **PWA** (Add to Home Screen / desktop install) with
  an offline-capable app shell.
- An in-app **"How ranking works"** page (plain-language explainer and
  glossary of every term) and a **"What's new"** changelog page
  reconstructing the full release history.
- An optional lightweight **shared-passphrase gate** (not authentication
  -- see `docs/no-auth-deployment.md`) that can sit in front of a public
  deployment.
- No sign-up or accounts -- open the link, pick your name, and start
  playing.

## Tech stack

- **Angular 21** -- standalone components, signals, and the
  `@angular/build` (esbuild/Vite) application builder.
- **Angular Material 3** for UI components and theming.
- **Supabase** (Postgres + RPC) as the backend: schema and
  `SECURITY DEFINER` functions live under `supabase/migrations/`.
- **Vitest**, via the Angular CLI's `@angular/build:unit-test` builder,
  for unit tests.
- **Angular Service Worker** for the PWA/offline shell.
- Deployed statically to **GitHub Pages** by a GitHub Actions workflow
  (`.github/workflows/deploy-pages.yml`) on every push to `main`.

## Project structure

```
src/app/
  core/           Services, models, i18n (EN/PT translation dictionaries),
                   the changelog data, and the passphrase gate.
  rank/            Elo, rank, and statistics calculations (rank/RR
                   thresholds, teammate/head-to-head/team stats), plus
                   their unit tests -- this is the pure "ranking engine".
  features/        One folder per routed page: dashboard, leaderboard,
                   matches (history + record), live-match, players,
                   random-teams, team-names, seasons, how-it-works,
                   changelog.
  shared/          Reusable presentational components (rank badge, theme
                   toggle, install button, language switcher, passphrase
                   gate UI).
supabase/migrations/   The Postgres schema and RPCs, applied in order.
docs/                  Deployment and Supabase setup guides.
table-football-ranked-app-spec-v2.md   The full product/rules spec.
```

## No-auth model

There are no accounts, roles, or private data. Anyone with the app URL
can submit a match through the public `record_match` RPC; the optional
passphrase gate (see above) only hides the app's existence from casual
visitors, it does not add real authorization. Do not put anything
sensitive behind this deployment. Full detail in
`docs/no-auth-deployment.md`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Public Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes | Public anon/publishable key. Never use the service-role key here. |
| `ACCESS_PASSPHRASE` | No | Plaintext passphrase for the shared access gate. Only its SHA-256 hash is ever built into the app -- see `docs/no-auth-deployment.md`. Leave unset to disable the gate. |

**Production** (GitHub Pages): set these as GitHub Actions secrets in the
repository's Settings -> Secrets and variables -> Actions (see
`docs/git-and-supabase-setup.md`). The deploy workflow generates
`src/environments/environment.production.ts` from them at build time, and
`angular.json`'s production configuration swaps it in for
`src/environments/environment.ts` via `fileReplacements`.

**Local development** (`ng serve`): `src/environments/environment.ts` is
committed to git with blank placeholders -- never put real values directly
in that tracked file. Instead:

1. Copy `.env.example` to `.env` (already git-ignored) and fill in your
   values.
2. Run `npm run env:local`. This reads `.env` and rewrites
   `src/environments/environment.ts` locally, the same way the deploy
   workflow does for the production file.
3. Run `ng serve` as usual.

`npm run env:local` overwrites your local copy of `environment.ts` with real
values, so `git status` will show it as modified after you run it -- don't
commit that. If you'd rather git stopped showing it as changed at all, run
`git update-index --skip-worktree src/environments/environment.ts` once (undo
with `--no-skip-worktree` if you ever need to pull in a real change to that
file).

## Getting started

Prerequisites: Node 22+ and npm 10+ (matching the deploy workflow).

```bash
npm ci                     # install dependencies
npm run env:local          # generate environment.ts from .env (see above)
ng serve                   # start the dev server
```

The dev server defaults to `http://localhost:4200/` and reloads
automatically as you edit source files.

## Building

```bash
ng build
```

Compiles the project and writes build artifacts to `dist/`. The
production configuration (the default) optimizes for size and speed and
registers the service worker; `ng build --configuration development` skips
optimization for faster, more debuggable local builds.

## Running unit tests

```bash
ng test
```

Runs the unit test suite (rank/Elo math, team and head-to-head stats,
etc.) with Vitest via the Angular CLI's unit-test builder. There is no
end-to-end test setup in this project.

## Deployment

Every push to `main` triggers `.github/workflows/deploy-pages.yml`, which
installs dependencies, writes `environment.production.ts` from the repo's
GitHub Actions secrets (hashing `ACCESS_PASSPHRASE` if set), builds with
`ng build --configuration production --base-href "/<repo-name>/"`, and
publishes the result to GitHub Pages. See `docs/git-and-supabase-setup.md`
for the one-time repository and Supabase project setup this depends on.

## Database

`supabase/migrations/` is the source of truth for the Postgres schema and
the `SECURITY DEFINER` RPCs the app calls (`record_match`, `start_season`,
and the rest) -- apply them in filename order against a fresh Supabase
project. They also carry the project's rule history as it evolved: the
Demotion Shield being extended to every rank, placement matches being
raised from 5 to 10, match rewind, player activation, and custom team
names all landed as migrations here, not just as frontend changes.

## Documentation

- `table-football-ranked-app-spec-v2.md` -- the full product spec: every
  ranking rule, formula, and dated addendum as the app evolved.
- `docs/no-auth-deployment.md` -- the no-auth model and the passphrase
  gate, in detail.
- `docs/git-and-supabase-setup.md` -- one-time setup for a new clone:
  GitHub secrets, the Supabase project, and applying migrations.
- In the app itself: **How ranking works** (`/how-it-works`) explains
  every rank/Elo/RR concept in plain language for players, and
  **What's new** (`/changelog`) lists what changed in each release.

## Additional resources

This project was generated with the [Angular CLI](https://github.com/angular/angular-cli).
For more on the CLI itself, see the
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
