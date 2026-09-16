# No-auth deployment model

This application is a standalone trusted-group tool intended for the Multicert
mTrust development team. It has no authentication, accounts, roles, or private
data. Anyone who can access the public application can potentially submit a
match through the permitted public RPC.

The intended audience does not create a technical mTrust integration: this
project must not depend on mTrust repositories, services, authentication, or
production data.

The Angular bundle may contain only the Supabase project URL and browser-safe
anonymous key. Never add `SUPABASE_SERVICE_ROLE_KEY` or another secret to
environment files consumed by Angular. Derived player ratings and history must
be written only by the server-authoritative `record_match` RPC.

The RPC is intentionally `SECURITY DEFINER` because the public browser client
must not receive direct table-write privileges. Its `search_path` is fixed to
`pg_catalog, public`, and execution is granted only to `anon`; the Supabase
security advisor may still report anonymous execution as a warning because
public match submission is an intentional part of this no-auth deployment.

GitHub Pages hosts the static Angular application; Supabase hosts PostgreSQL,
the API, row-level policies, and the match-processing RPC.