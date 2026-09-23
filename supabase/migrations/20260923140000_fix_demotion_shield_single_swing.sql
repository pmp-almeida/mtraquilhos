-- Fixes a real production bug: the Demotion Shield never armed for a match
-- that carried a player from mid-division straight past their rank floor in
-- one hit (e.g. Iron I at 37 RR losing a bigger-than-usual Elo swing and
-- landing directly in Lixo). Confirmed against rating_events: a player at
-- Iron I / 37 RR lost, dropped 17 Elo to below 500, and was demoted to Lixo
-- with demotion_shield_before/after both false the whole time -- the shield
-- simply never had a chance to engage.
--
-- Root cause: the previous v_at_floor check required v_before_rr = 0, i.e.
-- the player had to already be sitting exactly at the division floor going
-- into the match. That matches the spec's worked example (Gold II at 0 RR,
-- then a *separate, later* match drops them further), but it silently
-- excludes the much more common case of a single match's swing being large
-- enough to cross the floor on its own, without a prior "parked at 0 RR"
-- match ever happening. Per section 18/48 of the spec, the shield is meant
-- to protect "every rank a player can hold, with no exception" the *first*
-- time a match would demote them -- there's no basis in the spec for that
-- protection depending on how many Elo points the demoting loss happened to
-- be worth.
--
-- Fix: a demotion is any loss, for an already-ranked (not Unranked/Lixo)
-- player, whose resulting Elo now computes to a lower rank than they held
-- before the match -- full stop, regardless of what their RR was going in.
-- This is both simpler than the old "at floor" precondition and strictly
-- more correct: every case the old check caught, this one still catches
-- (rr_before = 0 and a loss that changes rank is trivially "a loss that
-- changes rank"), plus the single-big-swing case it used to miss. Champion
-- no longer needs a special-cased branch either -- "ranked, not Unranked,
-- not Lixo" already includes it, and a Champion player's Elo can only ever
-- go down via a loss, so "not v_won and rank changed" is exactly the
-- Champion-drops-to-Emerald-III case too.
--
-- Everything else in record_match (Elo math, placement handling, the
-- pending/demotion-match resolution once a shield IS armed, season stat
-- bookkeeping) is unchanged -- this migration only replaces the trigger
-- condition for arming the shield in the first place.
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
  v_would_demote boolean;
  v_new_placement_played integer;
  v_new_placement_complete boolean;
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

    v_new_placement_played := least(10, v_player.placement_matches_played + 1);
    v_new_placement_complete := (v_new_placement_played = 10);

    if not v_new_placement_complete then
      v_after_rank := 'Unranked';
      v_after_rr := null;
      v_after_shield := false;
      v_after_pending := false;
    else
      v_after := rank_for_elo(v_elo_after);
      v_after_rank := v_after->>'label';
      v_after_rr := (v_after->>'rr')::integer;
      v_after_shield := v_before_shield;
      v_after_pending := v_player.demotion_pending;

      -- Any loss that lowers an already-ranked player's rank is a demotion,
      -- no matter how much Elo it cost them or where their RR started.
      v_would_demote := v_before_rank not in ('Unranked', 'Lixo') and not v_won and v_after_rank <> v_before_rank;

      if v_player.demotion_pending then
        v_after_shield := false;
        v_after_pending := false;
        if v_won then
          v_after_rank := v_before_rank;
          v_after_rr := v_before_rr;
        end if;
      elsif v_would_demote then
        v_after_shield := true;
        v_after_pending := true;
        v_after_rank := v_before_rank;
        v_after_rr := v_before_rr;
      end if;
    end if;

    update players set
        current_elo = v_elo_after,
        peak_elo = greatest(peak_elo, v_elo_after),
        wins = wins + case when v_won then 1 else 0 end,
        losses = losses + case when v_won then 0 else 1 end,
        placement_matches_played = v_new_placement_played,
        placement_complete = v_new_placement_complete,
        visible_rank = v_after_rank,
        rr = v_after_rr,
        demotion_shield_active = v_after_shield,
        demotion_pending = v_after_pending
      where id = v_player.id;

    insert into rating_events (
        match_id, player_id, elo_before, elo_after, elo_delta,
        rank_before, rank_after, rr_before, rr_after,
        placement_matches_before, placement_matches_after,
        demotion_shield_before, demotion_shield_after
      ) values (
        v_match_id, v_player.id, v_elo_before, v_elo_after, v_signed_delta,
        v_before_rank, v_after_rank, v_before_rr, v_after_rr,
        v_player.placement_matches_played, v_new_placement_played,
        v_before_shield, v_after_shield
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
