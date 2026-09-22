-- Demotion Shield must protect every rank, including the Iron I -> Lixo
-- boundary and the Champion tier (which has no division/RR of its own).
--
-- Two bugs in the original record_match are fixed here:
--   1. The shield never triggered when a demotion would land in Lixo,
--      because the trigger condition required `v_after_rr is not null`.
--      Lixo's rr is always null, so Iron I players fell straight through
--      to Lixo with no shield protection.
--   2. When a shielded player WON their demotion match, the function still
--      recomputed their rank straight from the new Elo instead of forcing
--      the protected rank to stick. Per spec section 19, winning the
--      demotion match must retain the protected visible rank regardless of
--      whether the post-win Elo maps back to that exact rank.
--
-- Champion is now treated as a "division floor" of its own: a Champion
-- player (current_elo >= 1340) who drops below 1340 gets the same shield
-- treatment as any other player sitting at the bottom of their division.

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
      -- Still in placements: no visible rank, no RR, no shield yet.
      update players set visible_rank = 'Unranked', rr = null, demotion_shield_active = false, demotion_pending = false
        where id = v_player.id;
      v_after_rank := 'Unranked'; v_after_rr := null;
    else
      v_after := rank_for_elo(v_elo_after);
      v_after_rank := v_after->>'label';
      v_after_rr := (v_after->>'rr')::integer;
      v_after_shield := v_before_shield;
      v_after_pending := v_player.demotion_pending;

      -- A player sits "at the floor" of their current rank when either:
      --  - they are in a normal division at 0 RR (the bottom of that division), or
      --  - they are Champion (which has no RR; any drop below 1340 is a floor event).
      v_at_floor := (v_before_rank = 'Champion')
        or (v_before_rank not in ('Unranked', 'Lixo', 'Champion') and v_before_rr = 0);

      if v_player.demotion_pending then
        -- Resolving a shielded demotion match: the shield is always consumed.
        v_after_shield := false;
        v_after_pending := false;
        if v_won then
          -- Winning the demotion match retains the protected rank/RR exactly,
          -- even if the resulting Elo does not (yet) map back to it.
          v_after_rank := v_before_rank;
          v_after_rr := v_before_rr;
        end if;
        -- Losing falls straight through to the freshly computed (lower) rank.
      elsif v_at_floor and v_after_rank <> v_before_rank then
        -- New demotion-shield trigger: freeze the visible rank/RR and arm the shield.
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
  end loop;

  return jsonb_build_object(
    'matchId', v_match_id, 'expectedProbability', v_ea,
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
