#!/usr/bin/env node
/**
 * Populates src/environments/environment.ts for local `ng serve` from a
 * git-ignored `.env` file in the repo root (copy .env.example to .env and
 * fill it in first). This mirrors exactly what
 * .github/workflows/deploy-pages.yml does for environment.production.ts in
 * CI, so local dev and the deployed build are configured the same way.
 *
 * Nothing this script writes is a secret: SUPABASE_URL and
 * SUPABASE_ANON_KEY are the public, Row-Level-Security-protected
 * publishable key, safe to ship to a browser -- this only keeps real
 * project values out of tracked source. ACCESS_PASSPHRASE, if set, is
 * hashed here and only the hash is written; the plaintext never touches
 * environment.ts, the same guarantee the CI workflow makes.
 *
 * environment.ts stays committed with blank placeholders so a fresh clone
 * still builds without this script. Running it overwrites your local copy
 * with real values -- don't commit that change. If you want git to stop
 * showing it as modified after every run, see the optional
 * `git update-index --skip-worktree` note in README.md.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'src/environments/environment.ts');

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

if (!fs.existsSync(envPath)) {
  console.warn('[env:local] No .env found at the repo root -- copy .env.example to .env and fill in your values first.');
  console.warn('[env:local] Writing environment.ts with blank placeholders in the meantime.');
}

const vars = parseEnvFile(envPath);
const supabaseUrl = vars.SUPABASE_URL ?? '';
const supabaseAnonKey = vars.SUPABASE_ANON_KEY ?? '';
const accessPassphrase = vars.ACCESS_PASSPHRASE ?? '';

// Matches the CI step's `printf '%s' "$ACCESS_PASSPHRASE" | sha256sum`
// exactly: hash the raw value, no trimming, lowercase hex digest.
const accessPassphraseHash = accessPassphrase
  ? crypto.createHash('sha256').update(accessPassphrase, 'utf8').digest('hex')
  : '';

const contents = `export const environment = {
  production: false,
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
  accessPassphraseHash: '${accessPassphraseHash}'
};
`;

fs.writeFileSync(outPath, contents);
console.log(`[env:local] Wrote ${path.relative(root, outPath)} from ${fs.existsSync(envPath) ? '.env' : 'blank placeholders'}.`);
console.log('[env:local] Remember: this file is tracked by git with blank placeholders. Avoid committing your local values.');
