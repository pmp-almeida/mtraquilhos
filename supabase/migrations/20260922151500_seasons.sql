-- Seasons: a Valorant-Act-style soft reset. A season compresses every
-- active player's Elo toward the group mean instead of wiping it, so
-- lifetime history (peak_elo, wins/losses, rating_events, matches) is
-- untouched while the competitive ladder gets a periodic refresh.
--
-- Only one season may be active at a time. Matches recorded while a season
-- is active are tagged with that season_id; matches recorded with no active
-- season (including everything recorded before this migration) have a null
-- season_id and are treated as "Season 0 / Pre-season" in the UI.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null,
  name text not null check (length(trim(name)) between 1 and 80),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_active boolean not null default false,
  compression_factor numeric not null default 0.5 check (compression_factor between 0 and 1),
  created_at timestamptz not null default now(),
  unique (season_number)
);

-- At most one active season at a time.
create unique index seasons_single_active_idx on public.seasons ((is_active)) where is_active;

create table public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  player_id uuid not null references public.players(id),
  starting_elo integer not null,
  current_elo integer not null,
  peak_elo integer not null,
  final_rank text,
  final_rr integer,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, player_id)
);

alter table public.matches add column season_id uuid references public.seasons(id);

create index seasons_active_idx on public.seasons (is_active);
create index matches_season_idx on public.matches (season_id);
create index player_season_stats_leaderboard_idx on public.player_season_stats (season_id, current_elo desc);

alter table public.seasons enable row level security;
alter table public.player_season_stats enable row level security;
create policy seasons_public_read on public.seasons for select using (true);
create policy player_season_stats_public_read on public.player_season_stats for select using (true);
revoke insert, update, delete on public.seasons, public.player_season_stats from anon, authenticated;

-- Starts a new season: closes the current one (if any) and compresses every
-- active player's Elo toward the group mean by compression_factor
-- (0 = no compression/hard carryover, 1 = everyone reset to the mean).
-- Demotion shields are cleared so every player gets a fresh one next season.
create or replace function public.start_season(
  p_name text,
  p_compression_factor numeric default 0.5
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_previous_season record;
  v_new_season_id uuid;
  v_next_number integer;
  v_mean numeric;
  v_player record;
  v_new_elo integer;
  v_rank jsonb;
  v_new_rank text;
  v_new_rr integer;
  v_players_compressed integer := 0;
begin
  if trim(coalesce(p_name, '')) = '' then raise exception 'season name is required'; end if;
  if p_compression_factor is null or p_compression_factor < 0 or p_compression_factor > 1 then
    raise exception 'compression factor must be between 0 and 1';
  end if;

  select * into v_previous_season from seasons where is_active for update;
  if found then
    update seasons set is_active = false, ended_at = now() where id = v_previous_season.id;
    update player_season_stats pss set
        final_rank = p.visible_rank, final_rr = p.rr,
        current_elo = p.current_elo, peak_elo = greatest(pss.peak_elo, p.current_elo),
        updated_at = now()
      from players p where pss.season_id = v_previous_season.id and pss.player_id = p.id;
  end if;

  select coalesce(max(season_number), 0) + 1 into v_next_number from seasons;
  insert into seasons (season_number, name, compression_factor, is_active)
    values (v_next_number, trim(p_name), p_compression_factor, true)
    returning id into v_new_season_id;

  select avg(current_elo) into v_mean from players where active;
  v_mean := coalesce(v_mean, 520);

  for v_player in select * from players where active order by id for update loop
    v_new_elo := greatest(100, round(v_mean + (v_player.current_elo - v_mean) * (1 - p_compression_factor))::integer);

    if v_player.placement_complete then
      v_rank := rank_for_elo(v_new_elo);
      v_new_rank := v_rank->>'label';
      v_new_rr := (v_rank->>'rr')::integer;
    else
      v_new_rank := 'Unranked';
      v_new_rr := null;
    end if;

    update players set
        current_elo = v_new_elo,
        peak_elo = greatest(peak_elo, v_new_elo),
        visible_rank = v_new_rank,
        rr = v_new_rr,
        demotion_shield_active = false,
        demotion_pending = false
      where id = v_player.id;

    insert into player_season_stats (season_id, player_id, starting_elo, current_elo, peak_elo, final_rank, final_rr)
      values (v_new_season_id, v_player.id, v_new_elo, v_new_elo, v_new_elo, v_new_rank, v_new_rr);

    v_players_compressed := v_players_compressed + 1;
  end loop;

  return jsonb_build_object(
    'seasonId', v_new_season_id, 'seasonNumber', v_next_number, 'name', trim(p_name),
    'compressionFactor', p_compression_factor, 'meanElo', v_mean, 'playersCompressed', v_players_compressed
  );
end;
$$;

revoke execute on function public.start_season(text, numeric) from public, authenticated;
grant execute on function public.start_season(text, numeric) to anon;

-- record_match is redefined to stamp the active season onto every match and
-- keep a running per-season stat line for each player, in addition to the
-- all-ranks demotion-shield fix from the previous migration.
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
  v_season_id uuid;
  v_player record;
  v_is_team_a boolean;
  v_won boolean;
  v_signed_delta integer;
  v_elo_before integer;
  v_elo_after integer;
  v_before_rank text;
  v_before_rr integer;
  v_before_shield boolean;
  v_at_floor boolean;
  v_after jsonb;
  v_after_rank text;
  v_after_rr integer;
  v_after_shield boolean;
  v_after_pending boolean;
begin
  if p_winner not in ('A', 'B') or array_position(v_ids, null) is not null then
    raise exception 'invalid match input';
  end if;
  select count(distinct id), count(*) filter (where active) into v_unique_count, v_active_count
    from unnest(v_ids) as requested(id) join players using (id);
  if v_unique_count <> 4 or v_active_count <> 4 then raise exception 'four distinct active players are required'; end if;

  select id into v_season_id from seasons where is_active limit 1;

  perform 1 from players where id = any(v_ids) order by id for update;
  select avg(current_elo) filter (where id in (p_team_a_player_1, p_team_a_player_2)),
         avg(current_elo) filter (where id in (p_team_b_player_1, p_team_b_player_2))
    into v_a_elo, v_b_elo from players where id = any(v_ids);
  v_ea := 1 / (1 + power(10, (v_b_elo - v_a_elo) / 400));
  v_delta := round(32 * case when p_winner = 'A' then 1 - v_ea else v_ea end);

  insert into matches (team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2, winner, score_a, score_b, played_at, note, season_id)
    values (p_team_a_player_1, p_team_a_player_2, p_team_b_player_1, p_team_b_player_2, p_winner, p_score_a, p_score_b, coalesce(p_played_at, now()), p_note, v_season_id)
    returning id into v_match_id;

  for v_player in select * from players where id = any(v_ids) order by id loop
    v_is_team_a := v_player.id in (p_team_a_player_1, p_team_a_player_2);
    v_won := v_is_team_a = (p_winner = 'A');
    v_signed_delta := case when v_won then v_delta else -v_delta end;
    v_elo_before := v_player.current_elo;
    v_elo_after := v_elo_before + v_signed_delta;

    v_before_rank := v_player.visible_rank;
    v_before_rr := v_player.rr;
    v_before_shield := v_player.demotion_shield_active;

    update players set
        current_elo = v_elo_after,
        peak_elo = greatest(peak_elo, v_elo_after),
        wins = wins + case when v_won then 1 else 0 end,
        losses = losses + case when v_won then 0 else 1 end,
        placement_matches_played = least(5, placement_matches_played + 1),
        placement_complete = (least(5, placement_matches_played + 1) = 5)
      where id = v_player.id;
    select * into v_player from players where id = v_player.id;

    if not v_player.placement_complete then
      update players set visible_rank = 'Unranked', rr = null, demotion_shield_active = false, demotion_pending = false
        where id = v_player.id;
      v_after_rank := 'Unranked'; v_after_rr := null;
    else
      v_after := rank_for_elo(v_elo_after);
      v_after_rank := v_after->>'label';
      v_after_rr := (v_after->>'rr')::integer;
      v_after_shield := v_before_shield;
      v_after_pending := v_player.demotion_pending;

      v_at_floor := (v_before_rank = 'Champion')
        or (v_before_rank not in ('Unranked', 'Lixo', 'Champion') and v_before_rr = 0);

      if v_player.demotion_pending then
        v_after_shield := false;
        v_after_pending := false;
        if v_won then
          v_after_rank := v_before_rank;
          v_after_rr := v_before_rr;
        end if;
      elsif v_at_floor and v_after_rank <> v_before_rank then
        v_after_shield := true;
        v_after_pending := true;
        v_after_rank := v_before_rank;
        v_after_rr := v_before_rr;
      end if;

      update players set visible_rank = v_after_rank, rr = v_after_rr,
          demotion_shield_active = v_after_shield, demotion_pending = v_after_pending
        where id = v_player.id;
    end if;

    insert into rating_events (
        match_id, player_id, elo_before, elo_after, elo_delta,
        rank_before, rank_after, rr_before, rr_after,
        placement_matches_before, placement_matches_after,
        demotion_shield_before, demotion_shield_after
      ) values (
        v_match_id, v_player.id, v_elo_before, v_elo_after, v_signed_delta,
        v_before_rank, v_after_rank, v_before_rr, v_after_rr,
        greatest(0, v_player.placement_matches_played - 1), v_player.placement_matches_played,
        v_before_shield, v_player.demotion_shield_active
      );

    if v_season_id is not null then
      insert into player_season_stats (season_id, player_id, starting_elo, current_elo, peak_elo, final_rank, final_rr, wins, losses, matches_played)
        values (v_season_id, v_player.id, v_elo_before, v_elo_after, v_elo_after, v_after_rank, v_after_rr,
                case when v_won then 1 else 0 end, case when v_won then 0 else 1 end, 1)
        on conflict (season_id, player_id) do update set
          current_elo = excluded.current_elo,
          peak_elo = greatest(player_season_stats.peak_elo, excluded.current_elo),
          final_rank = excluded.final_rank,
          final_rr = excluded.final_rr,
          wins = player_season_stats.wins + excluded.wins,
          losses = player_season_stats.losses + excluded.losses,
          matches_played = player_season_stats.matches_played + 1,
          updated_at = now();
    end if;
  end loop;

  return jsonb_build_object(
    'matchId', v_match_id, 'seasonId', v_season_id, 'expectedProbability', v_ea,
    'teamAElo', v_a_elo, 'teamBElo', v_b_elo, 'teamDelta', v_delta,
    'players', (select jsonb_agg(to_jsonb(e)) from rating_events e where e.match_id = v_match_id)
  );
end;
$$;

alter function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  set search_path = pg_catalog, public;
revoke execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  from public, authenticated;
grant execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  to anon;
