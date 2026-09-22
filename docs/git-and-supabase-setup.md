# Git and Supabase setup

The project is an independent Git repository. To publish it, create an empty
GitHub repository and run:

```text
git remote add origin https://github.com/<owner>/<repository>.git
git add .
git commit -m "Bootstrap Table Football Ranked app"
git branch -M main
git push -u origin main
```

In the GitHub repository settings, add `SUPABASE_URL` and
`SUPABASE_ANON_KEY` as Actions secrets. Optionally add `ACCESS_PASSPHRASE` to
enable the shared-passphrase access gate (see `docs/no-auth-deployment.md`);
only its SHA-256 hash is ever built into the app. These are the only values
injected into the browser build.

Apply the SQL migrations in `supabase/migrations`, in filename (timestamp)
order, before using the deployed application:

1. `20260916180000_initial_schema_and_record_match.sql` -- base schema and the
   `record_match` RPC.
2. `20260916194000_harden_function_security.sql` -- fixes function search
   paths and removes unnecessary authenticated RPC access.
3. `20260922140800_allow_public_player_creation.sql` -- lets the no-auth
   frontend create players.
4. `20260922150000_demotion_shield_all_ranks.sql` -- fixes the Demotion
   Shield so it protects every rank, including the Iron I -> Lixo boundary
   and Champion.
5. `20260922151500_seasons.sql` -- adds the `seasons` and
   `player_season_stats` tables and the `start_season` RPC, and redefines
   `record_match` to stamp the active season onto every match.

If some of these were already applied from an earlier deployment, apply only
the ones you're missing -- each migration is additive and safe to run once,
in order.
