# Supabase setup

1. Create a free Supabase project and copy its project URL and public anon key
   into the deployment environment. Keep the service-role key out of Angular.
2. Apply `migrations/20260916180000_initial_schema_and_record_match.sql` using
   the Supabase SQL editor or the Supabase CLI.
3. Verify that the `players`, `matches`, and `rating_events` tables have public
   read policies, no direct write privileges, and that `record_match` is
   executable by the browser roles.

The RPC is the only supported write boundary for derived ratings and history.
If an RPC call raises an exception, PostgreSQL rolls back the whole match
transaction, including player changes and inserted history rows.