-- Adds Match Rewind: reverting a recorded match, restoring all four
-- players' Elo/rank/RR/placement/Demotion Shield state to exactly what it
-- was before that match, then deleting the match and its rating_events.
--
-- Safety rule: a match can only be rewound while it is still the MOST
-- RECENT recorded match for every one of its four players. If any of them
-- has played a later match since, that later match's Elo delta was computed
-- from a current_elo that already includes this match's effect -- silently
-- restoring this match's "before" snapshot underneath it would corrupt that
-- later result. So rewinds must happen newest-first, one match at a time,
-- exactly like popping a stack. "Most recent" is judged by rating_events
-- .created_at (when the row was actually written), not matches.played_at
-- (a user-editable "when this was played" field that can be backdated and
-- so cannot be trusted for ordering).
--
-- Elo/rank/RR/placement counters/Demotion Shield all come straight back
-- from the *_before columns already captured on rating_events at record
-- time -- nothing new needs to be computed for those. demotion_pending
-- isn't separately stored on rating_events, but record_match maintains it
-- as always exactly equal to demotion_shield_active (every branch that
-- changes one changes the other in lockstep), so demotion_shield_before
-- doubles as demotion_pending_before too.
--
-- peak_elo is the one field that can't just be copied from a column: it's a
-- running high-water mark, so undoing this match might also need to lower
-- it back down. It's recomputed as the highest Elo this player is still
-- known to have reached from everything OTHER than the match being
-- rewound (their pre-match Elo, or the highest elo_after of any of their
-- other rating_events) -- correct regardless of how peak_elo got to its
-- current value.
create or replace function public.rewind_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_match record;
  v_event record;
  v_player_ids uuid[];
  v_id uuid;
  v_this_created_at timestamptz;
  v_won boolean;
  v_new_peak integer;
  v_new_season_peak integer;
  v_results jsonb := '[]'::jsonb;
begin
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'match not found'; end if;

  v_player_ids := array[v_match.team_a_player_1, v_match.team_a_player_2, v_match.team_b_player_1, v_match.team_b_player_2];

  perform 1 from players where id = any(v_player_ids) order by id for update;

  foreach v_id in array v_player_ids loop
    select created_at into v_this_created_at from rating_events where match_id = p_match_id and player_id = v_id;
    if v_this_created_at is null then
      raise exception 'no rating history found for this match -- it may already have been rewound';
    end if;
    if exists (select 1 from rating_events where player_id = v_id and created_at > v_this_created_at) then
      raise exception 'cannot rewind: a more recent match exists for one of these players. Rewind matches newest-first.';
    end if;
  end loop;

  for v_event in select * from rating_events where match_id = p_match_id loop
    v_won := v_event.player_id in (v_match.team_a_player_1, v_match.team_a_player_2) = (v_match.winner = 'A');

    select greatest(520, v_event.elo_before, coalesce(max(elo_after), 0))
      into v_new_peak
      from rating_events where player_id = v_event.player_id and match_id <> p_match_id;

    update players set
        current_elo = v_event.elo_before,
        peak_elo = v_new_peak,
        wins = greatest(0, wins - case when v_won then 1 else 0 end),
        losses = greatest(0, losses - case when v_won then 0 else 1 end),
        placement_matches_played = v_event.placement_matches_before,
        placement_complete = (v_event.placement_matches_before >= 10),
        visible_rank = v_event.rank_before,
        rr = v_event.rr_before,
        demotion_shield_active = v_event.demotion_shield_before,
        demotion_pending = v_event.demotion_shield_before
      where id = v_event.player_id;

    if v_match.season_id is not null then
      select greatest(v_event.elo_before, coalesce(max(re.elo_after), v_event.elo_before))
        into v_new_season_peak
        from rating_events re
        join matches m on m.id = re.match_id
        where re.player_id = v_event.player_id and re.match_id <> p_match_id and m.season_id = v_match.season_id;

      update player_season_stats set
          current_elo = v_event.elo_before,
          peak_elo = v_new_season_peak,
          final_rank = v_event.rank_before,
          final_rr = v_event.rr_before,
          wins = greatest(0, wins - case when v_won then 1 else 0 end),
          losses = greatest(0, losses - case when v_won then 0 else 1 end),
          matches_played = greatest(0, matches_played - 1),
          updated_at = now()
        where season_id = v_match.season_id and player_id = v_event.player_id;
    end if;

    v_results := v_results || jsonb_build_object(
      'playerId', v_event.player_id,
      'eloRestored', v_event.elo_before,
      'rankRestored', v_event.rank_before,
      'rrRestored', v_event.rr_before
    );
  end loop;

  delete from rating_events where match_id = p_match_id;
  delete from matches where id = p_match_id;

  return jsonb_build_object('matchId', p_match_id, 'players', v_results);
end;
$$;

alter function public.rewind_match(uuid) set search_path = pg_catalog, public;
revoke execute on function public.rewind_match(uuid) from public, authenticated;
grant execute on function public.rewind_match(uuid) to anon;
