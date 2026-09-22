-- Player creation is intentionally public for the no-auth frontend.
-- Restrict anon inserts to the name so database defaults initialize all rating state.
grant insert (display_name) on table public.players to anon;
create policy players_public_insert on public.players
  for insert to anon
  with check (true);