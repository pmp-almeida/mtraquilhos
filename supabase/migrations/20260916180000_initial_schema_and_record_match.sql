create extension if not exists pgcrypto;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  starting_elo integer not null default 520 check (starting_elo = 520),
  current_elo integer not null default 520,
  peak_elo integer not null default 520,
  visible_rank text not null default 'Unranked',
  rr integer check (rr between 0 and 99),
  placement_matches_played integer not null default 0 check (placement_matches_played between 0 and 5),
  placement_complete boolean not null default false,
  demotion_shield_active boolean not null default false,
  demotion_pending boolean not null default false,
  active boolean not null default true,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  created_at timestamptz not null default now(),
  check (placement_complete = (placement_matches_played = 5)),
  check ((visible_rank = 'Unranked') = not placement_complete),
  check ((visible_rank in ('Unranked', 'Lixo', 'Champion') and rr is null)
    or (visible_rank not in ('Unranked', 'Lixo', 'Champion') and rr between 0 and 99)),
  check ((visible_rank = 'Unranked') = not demotion_shield_active)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_a_player_1 uuid not null references public.players(id),
  team_a_player_2 uuid not null references public.players(id),
  team_b_player_1 uuid not null references public.players(id),
  team_b_player_2 uuid not null references public.players(id),
  winner char(1) not null check (winner in ('A', 'B')),
  score_a integer check (score_a is null or score_a >= 0),
  score_b integer check (score_b is null or score_b >= 0),
  played_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  check (team_a_player_1 <> team_a_player_2),
  check (team_a_player_1 <> team_b_player_1),
  check (team_a_player_1 <> team_b_player_2),
  check (team_a_player_2 <> team_b_player_1),
  check (team_a_player_2 <> team_b_player_2),
  check (team_b_player_1 <> team_b_player_2)
);

create table public.rating_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  player_id uuid not null references public.players(id),
  elo_before integer not null,
  elo_after integer not null,
  elo_delta integer not null,
  rank_before text not null,
  rank_after text not null,
  rr_before integer,
  rr_after integer,
  placement_matches_before integer not null,
  placement_matches_after integer not null,
  demotion_shield_before boolean not null,
  demotion_shield_after boolean not null,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index players_leaderboard_idx on public.players (active, current_elo desc);
create index matches_played_at_idx on public.matches (played_at desc);
create index rating_events_player_idx on public.rating_events (player_id, created_at desc);

create or replace function public.rank_for_elo(p_elo integer)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select case
    when p_elo < 500 then jsonb_build_object('tier', 'Lixo', 'division', null, 'rr', null, 'label', 'Lixo')
    when p_elo >= 1340 then jsonb_build_object('tier', 'Champion', 'division', null, 'rr', null, 'label', 'Champion')
    else jsonb_build_object(
      'tier', case when p_elo < 620 then 'Iron' when p_elo < 740 then 'Bronze'
        when p_elo < 860 then 'Silver' when p_elo < 980 then 'Gold'
        when p_elo < 1100 then 'Platinum' when p_elo < 1220 then 'Diamond'
        else 'Emerald' end,
      'division', case (floor((p_elo - 500) / 40)::integer % 3) when 0 then 'I' when 1 then 'II' else 'III' end,
      'rr', least(99, floor(((p_elo - (500 + floor((p_elo - 500) / 40)::integer * 40)) / 40.0) * 100)::integer),
      'label', (case when p_elo < 620 then 'Iron' when p_elo < 740 then 'Bronze'
        when p_elo < 860 then 'Silver' when p_elo < 980 then 'Gold'
        when p_elo < 1100 then 'Platinum' when p_elo < 1220 then 'Diamond'
        else 'Emerald' end) || ' ' || (case (floor((p_elo - 500) / 40)::integer % 3) when 0 then 'I' when 1 then 'II' else 'III' end)
    )
  end;
$$;

create or replace function public.record_match(
  p_team_a_player_1 uuid, p_team_a_player_2 uuid,
  p_team_b_player_1 uuid, p_team_b_player_2 uuid,
  p_winner char(1), p_score_a integer default null, p_score_b integer default null,
  p_played_at timestamptz default now(), p_note text default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_ids uuid[] := array[p_team_a_player_1, p_team_a_player_2, p_team_b_player_1, p_team_b_player_2];
  v_unique_count integer;
  v_active_count integer;
  v_a_elo numeric;
  v_b_elo numeric;
  v_ea numeric;
  v_delta integer;
  v_match_id uuid;
  v_player record;
  v_before_rank text;
  v_after jsonb;
  v_after_rank text;
  v_after_rr integer;
  v_after_shield boolean;
  v_after_pending boolean;
  v_before_rr integer;
  v_before_shield boolean;
begin
  if p_winner not in ('A', 'B') or array_position(v_ids, null) is not null then
    raise exception 'invalid match input';
  end if;
  select count(distinct id), count(*) filter (where active) into v_unique_count, v_active_count
    from unnest(v_ids) as requested(id) join players using (id);
  if v_unique_count <> 4 or v_active_count <> 4 then raise exception 'four distinct active players are required'; end if;

  perform 1 from players where id = any(v_ids) order by id for update;
  select avg(current_elo) filter (where id in (p_team_a_player_1, p_team_a_player_2)),
         avg(current_elo) filter (where id in (p_team_b_player_1, p_team_b_player_2))
    into v_a_elo, v_b_elo from players where id = any(v_ids);
  v_ea := 1 / (1 + power(10, (v_b_elo - v_a_elo) / 400));
  v_delta := round(32 * case when p_winner = 'A' then 1 - v_ea else v_ea end);

  insert into matches (team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, winner, score_a, score_b, played_at, note)
    values (p_team_a_player_1, p_team_a_player_2, p_team_b_player_1, p_team_b_player_2, p_winner, p_score_a, p_score_b, coalesce(p_played_at, now()), p_note)
    returning id into v_match_id;

  for v_player in select * from players where id = any(v_ids) order by id loop
    v_before_rank := v_player.visible_rank; v_before_rr := v_player.rr; v_before_shield := v_player.demotion_shield_active;
    update players set current_elo = current_elo + case when (id = p_team_a_player_1 or id = p_team_a_player_2) then case when p_winner = 'A' then v_delta else -v_delta end else case when p_winner = 'B' then v_delta else -v_delta end end,
      peak_elo = greatest(peak_elo, current_elo + case when (id = p_team_a_player_1 or id = p_team_a_player_2) then case when p_winner = 'A' then v_delta else -v_delta end else case when p_winner = 'B' then v_delta else -v_delta end end),
      wins = wins + case when (id = p_team_a_player_1 or id = p_team_a_player_2) = (p_winner = 'A') then 1 else 0 end,
      losses = losses + case when (id = p_team_a_player_1 or id = p_team_a_player_2) <> (p_winner = 'A') then 1 else 0 end,
      placement_matches_played = least(5, placement_matches_played + 1),
      placement_complete = (least(5, placement_matches_played + 1) = 5)
      where id = v_player.id;
    select * into v_player from players where id = v_player.id;
    if not v_player.placement_complete then
      update players set visible_rank = 'Unranked', rr = null, demotion_shield_active = false, demotion_pending = false where id = v_player.id;
    else
      v_after := rank_for_elo(v_player.current_elo); v_after_rank := v_after->>'label'; v_after_rr := (v_after->>'rr')::integer;
      v_after_shield := v_player.demotion_shield_active; v_after_pending := v_player.demotion_pending;
      if v_player.demotion_pending then
        v_after_shield := false; v_after_pending := false;
        if not ((v_player.id = p_team_a_player_1 or v_player.id = p_team_a_player_2) = (p_winner = 'A')) then
          v_after_rank := v_after->>'label'; v_after_rr := (v_after->>'rr')::integer;
        end if;
      elsif v_after_rank <> v_player.visible_rank and v_player.rr = 0 and v_after_rr is not null then
        v_after_shield := true; v_after_pending := true; v_after_rank := v_player.visible_rank; v_after_rr := 0;
      end if;
      update players set visible_rank = v_after_rank, rr = v_after_rr, demotion_shield_active = v_after_shield, demotion_pending = v_after_pending where id = v_player.id;
    end if;
    insert into rating_events (match_id, player_id, elo_before, elo_after, elo_delta, rank_before, rank_after, rr_before, rr_after, placement_matches_before, placement_matches_after, demotion_shield_before, demotion_shield_after)
      values (v_match_id, v_player.id, v_player.current_elo - case when v_player.id = p_team_a_player_1 or v_player.id = p_team_a_player_2 then case when p_winner = 'A' then v_delta else -v_delta end else case when p_winner = 'B' then v_delta else -v_delta end end, v_player.current_elo, case when v_player.id = p_team_a_player_1 or v_player.id = p_team_a_player_2 then case when p_winner = 'A' then v_delta else -v_delta end else case when p_winner = 'B' then v_delta else -v_delta end end, v_before_rank, v_player.visible_rank, v_before_rr, v_player.rr, greatest(0, v_player.placement_matches_played - 1), v_player.placement_matches_played, v_before_shield, v_player.demotion_shield_active);
  end loop;
  return jsonb_build_object('matchId', v_match_id, 'expectedProbability', v_ea, 'teamAElo', v_a_elo, 'teamBElo', v_b_elo, 'teamDelta', v_delta, 'players', (select jsonb_agg(to_jsonb(e)) from rating_events e where e.match_id = v_match_id));
end;
$$;

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.rating_events enable row level security;
create policy players_public_read on public.players for select using (true);
create policy matches_public_read on public.matches for select using (true);
create policy rating_events_public_read on public.rating_events for select using (true);
revoke insert, update, delete on public.players, public.matches, public.rating_events from anon, authenticated;
revoke execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text) from public, authenticated;
grant execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text) to anon;