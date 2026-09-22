-- Fixes a second bug uncovered by testing the placement-completion fix in
-- production: players_check3 was written as a biconditional
--   (visible_rank = 'Unranked') = (NOT demotion_shield_active)
-- This does not just forbid an Unranked player from having an active
-- shield (the intended rule) -- as an unintended consequence of being an
-- iff rather than a one-directional rule, it ALSO forbids the single most
-- common state for a ranked player: demotion_shield_active = false.
-- Per spec section 18, a ranked player "can have" a one-use Demotion
-- Shield -- it's optional, inactive by default, and only becomes active
-- once armed at a rank floor. As written, this constraint required every
-- ranked player to ALWAYS have an active shield, which is never true in
-- normal play.
--
-- This was never caught before because, until the placement-matches-ten
-- fix landed earlier today, no match in this database's history had ever
-- been recorded for a player who had already left Unranked -- every match
-- so far happened during someone's placement run. The first player to
-- actually finish placement and have a match write their resulting row
-- (here, finishing placement on this very match) immediately hit it.
--
-- The correct rule is one-directional: an Unranked player must not have
-- an active shield (they have no rank yet to protect). A ranked player
-- may or may not have one active; both are valid states.
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname from pg_constraint
      where conrelid = 'public.players'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%demotion_shield_active%'
        and pg_get_constraintdef(oid) ilike '%unranked%'
  loop
    execute format('alter table public.players drop constraint %I', v_conname);
  end loop;
end $$;

alter table public.players
  add constraint players_unranked_has_no_shield_check
    check (not (visible_rank = 'Unranked' and demotion_shield_active));
