export const environment = {
  production: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Empty by default so local development is never gated. Set this to the
  // SHA-256 hex digest of a chosen passphrase to test the access gate
  // locally (see docs/no-auth-deployment.md for how to generate one).
  accessPassphraseHash: ''
};
