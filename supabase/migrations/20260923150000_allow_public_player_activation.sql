-- Players can be marked inactive (e.g. away on holiday, or no longer playing)
-- so they drop out of the active-player pool used for team generation, the
-- live-match player pickers, and match recording, without losing their
-- history: every read path (leaderboard, dashboard, live match, random
-- teams, record match) already filters on `active`, and record_match()
-- already requires all four participants to be active. The only missing
-- piece is a write path for the `active` flag itself.
--
-- Mirrors the narrow grant + permissive policy pattern used for public
-- player creation: anon may only ever write the `active` column, nothing
-- else on this table.
grant update (active) on table public.players to anon;
create policy players_public_update_active on public.players
  for update to anon
  using (true)
  with check (true);
