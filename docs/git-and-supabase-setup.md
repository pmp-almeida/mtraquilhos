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
6. `20260922155000_fix_placement_completion_constraint_race.sql` --
   **important bug fix, apply this even if you don't want 10 placement
   matches.** The original `record_match` wrote a player's placement
   completion and their resulting rank in two separate `UPDATE`s; Postgres
   checks constraints after every statement, so the moment a player's
   placement count reached the required number, the first `UPDATE` alone
   violated a check constraint and the whole match was rejected with a 400.
   No data was corrupted (the failing statement rolls back), but nobody can
   finish placement without this migration.
7. `20260922160000_placement_matches_ten.sql` -- raises the placement
   requirement from 5 to 10 matches (players table constraints and another
   `record_match` redefinition, built on the fix above). Players who already
   finished placement under the old rule of 5 keep their earned rank; only
   players still mid-placement, and every new player from this point on,
   need 10.
8. `20260922162000_fix_ranked_demotion_shield_check.sql` -- **also an
   important bug fix.** The original `players_check3` constraint was
   written as `(visible_rank = 'Unranked') = (NOT demotion_shield_active)`
   -- a biconditional that, besides correctly forbidding an Unranked player
   from having an active shield, also incorrectly forbade the single most
   common state for a ranked player: shield *inactive*. Every ranked
   player was required to always have an active Demotion Shield, which is
   never true in normal play. This went undetected until a player actually
   finished placement and played afterward, because every match recorded
   before that happened during someone's placement run. Replaces it with a
   one-directional constraint that only forbids Unranked + shield-active.

If some of these were already applied from an earlier deployment, apply only
the ones you're missing -- each migration is additive and safe to run once,
in order. If you're hitting a 400 with `players_check1` when someone
finishes placement, you're missing migration 6 above. If you're hitting a
400 with `players_check3` for an already-ranked player, you're missing
migration 8 above.
