-- Keep function name resolution deterministic for the immutable rank helper.
alter function public.rank_for_elo(integer)
  set search_path = pg_catalog;

-- The no-auth frontend intentionally calls this server-authoritative RPC as anon.
-- Do not expose it to PUBLIC or authenticated clients, and keep its definer path fixed.
alter function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  security definer
  set search_path = pg_catalog, public;

revoke execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  from public, authenticated;
grant execute on function public.record_match(uuid, uuid, uuid, uuid, char, integer, integer, timestamptz, text)
  to anon;