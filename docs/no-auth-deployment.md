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
be written only by the server-authoritative `record_match` and `start_season`
RPCs.

The RPCs are intentionally `SECURITY DEFINER` because the public browser
client must not receive direct table-write privileges. Their `search_path` is
fixed to `pg_catalog, public`, and execution is granted only to `anon`; the
Supabase security advisor may still report anonymous execution as a warning
because public match submission (and season resets) are an intentional part
of this no-auth deployment.

GitHub Pages hosts the static Angular application; Supabase hosts PostgreSQL,
the API, row-level policies, and the match-processing and season RPCs.

## The shared-passphrase access gate

This deployment optionally adds one more thing in front of the app: a single
shared passphrase, the same for everyone in the group. It is **not**
authentication and does not change the no-auth model above:

- There are no accounts, no per-user identity, and nothing server-side is
  gated by it -- the public Supabase RPCs remain reachable by anyone who has
  the app URL, exactly as before.
- It is enforced entirely in the browser. The build embeds only the SHA-256
  hash of the passphrase (see `.github/workflows/deploy-pages.yml`); the
  Angular app hashes what the visitor types and compares the two hashes. The
  plaintext passphrase is never in the repository, the build output, or
  network traffic.
- A successful unlock is remembered in that browser's `localStorage`, keyed by
  the current passphrase hash, so changing the passphrase (i.e. rotating the
  `ACCESS_PASSPHRASE` secret and redeploying) invalidates every previous
  unlock.
- It exists purely to keep the app from being casually stumbled into by
  strangers who guess or are handed the URL -- not to protect against a
  motivated user, who could always read the hash out of the built JavaScript
  or call the Supabase RPCs directly, same as before this gate existed.

Leave the `ACCESS_PASSPHRASE` repository secret unset to deploy without the
gate; the app then opens directly, matching the original no-auth behavior.
