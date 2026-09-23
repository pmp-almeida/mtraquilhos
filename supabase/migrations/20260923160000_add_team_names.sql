-- Lets two players who end up on the same team be given a fun, persistent
-- team name (e.g. Player A + Player B = "The Wall"), shown wherever that
-- exact pair appears together on a team: match history, the dashboard,
-- live match, generate teams, record match, and a player's own match list.
--
-- The pair is stored in canonical order (player_low < player_high) so a
-- lookup doesn't care which side of the match, or which order, the two
-- players ended up on -- there's exactly one name per unordered pair.
create table public.team_names (
  id uuid primary key default gen_random_uuid(),
  player_low uuid not null references public.players(id),
  player_high uuid not null references public.players(id),
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_low < player_high),
  unique (player_low, player_high)
);

create index team_names_lookup_idx on public.team_names (player_low, player_high);

alter table public.team_names enable row level security;
create policy team_names_public_read on public.team_names for select using (true);
revoke insert, update, delete on public.team_names from anon, authenticated;

-- Upsert-by-unordered-pair needs the canonicalization and validation done
-- server-side (same reasoning as record_match/rewind_match), so writes go
-- through these two SECURITY DEFINER functions rather than raw grants.
create or replace function public.set_team_name(p_player_1 uuid, p_player_2 uuid, p_name text)
returns public.team_names
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_low uuid;
  v_high uuid;
  v_name text := trim(p_name);
  v_row public.team_names;
begin
  if p_player_1 is null or p_player_2 is null then
    raise exception 'two players are required';
  end if;
  if p_player_1 = p_player_2 then
    raise exception 'a team needs two distinct players';
  end if;
  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'team name must be between 1 and 40 characters';
  end if;
  if not exists (select 1 from players where id = p_player_1)
    or not exists (select 1 from players where id = p_player_2) then
    raise exception 'unknown player';
  end if;

  v_low := least(p_player_1, p_player_2);
  v_high := greatest(p_player_1, p_player_2);

  insert into team_names (player_low, player_high, name)
  values (v_low, v_high, v_name)
  on conflict (player_low, player_high) do update set name = excluded.name, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

alter function public.set_team_name(uuid, uuid, text) set search_path = pg_catalog, public;
revoke execute on function public.set_team_name(uuid, uuid, text) from public, authenticated;
grant execute on function public.set_team_name(uuid, uuid, text) to anon;

create or replace function public.clear_team_name(p_player_1 uuid, p_player_2 uuid)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from team_names
  where player_low = least(p_player_1, p_player_2)
    and player_high = greatest(p_player_1, p_player_2);
end;
$$;

alter function public.clear_team_name(uuid, uuid) set search_path = pg_catalog, public;
revoke execute on function public.clear_team_name(uuid, uuid) from public, authenticated;
grant execute on function public.clear_team_name(uuid, uuid) to anon;
