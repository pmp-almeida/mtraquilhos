# TableFootballRankedApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.24.

## Purpose

Table Football Ranked is an internal recreational tool for the Multicert mTrust
development team. It remains a standalone application: it does not integrate
with mTrust services, repositories, authentication, or production data.

The Angular frontend is hosted as a static site and uses Supabase for the
application database and authoritative match processing. See
`docs/no-auth-deployment.md` and `docs/git-and-supabase-setup.md` before
sharing or deploying an instance.

## Feature overview

- Elo-based ranking (9 tiers, Iron-III divisions) with 5 placement matches per player.
- A one-use **Demotion Shield** protects every rank from an immediate drop the moment
  a player hits the floor of their current rank, Champion included -- see
  `table-football-ranked-app-spec-v2.md` section 18-20 for the exact rules.
- Optional **Seasons**: a Valorant-Act-style soft reset that compresses Elo toward the
  group average instead of wiping it. Started from the Seasons page; see section 48.
- A lightweight **shared-passphrase gate** (not authentication -- see section 49) that
  can optionally sit in front of the app.
- Random team generator, a full player profile (rank, streaks, teammate stats, season
  history), and a record-match flow with a projected-outcome preview and a post-match
  result summary.

## Environment variables

Set these as GitHub Actions secrets (see `docs/git-and-supabase-setup.md`) or in
`src/environments/environment.ts` for local development:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Public Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes | Public anon key. Never use the service-role key here. |
| `ACCESS_PASSPHRASE` | No | Plaintext passphrase for the shared access gate. Only its SHA-256 hash is ever built into the app -- see `docs/no-auth-deployment.md`. Leave unset to disable the gate. |

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4545/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
