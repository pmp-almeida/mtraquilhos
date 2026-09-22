import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * A lightweight, deliberately non-authenticating access gate: one shared
 * passphrase for the whole group, checked entirely in the browser against a
 * SHA-256 hash baked into the build. There are no accounts, no per-user
 * identity, and no server-side enforcement — it is a "knock before you
 * enter" screen, not a security boundary, consistent with this app's
 * explicit no-auth design (see spec section 3 and the Application Access
 * Gate section). Anyone who knows the passphrase (or reads it out of the
 * built bundle) can unlock the app, same as anyone with the app URL could
 * already call the public Supabase RPCs directly.
 *
 * When no passphrase hash is configured (local development by default) the
 * gate is inert and the app opens directly, matching the previous behavior.
 */
@Injectable({ providedIn: 'root' })
export class AccessGateService {
  private readonly storageKeyPrefix = 'tf-access-unlocked:';

  /** Whether a passphrase has been configured for this build at all. */
  readonly required = !!environment.accessPassphraseHash;

  readonly unlocked = signal<boolean>(!this.required || this.readStoredUnlock());

  async tryUnlock(passphrase: string): Promise<boolean> {
    if (!this.required) {
      this.unlocked.set(true);
      return true;
    }
    const hash = await this.sha256Hex(passphrase.trim());
    const ok = hash === environment.accessPassphraseHash;
    if (ok) {
      this.unlocked.set(true);
      this.writeStoredUnlock();
    }
    return ok;
  }

  /** Forgets the local unlock, showing the gate again on next load. */
  lock(): void {
    this.unlocked.set(false);
    try { localStorage.removeItem(this.storageKey()); } catch { /* storage unavailable */ }
  }

  private storageKey(): string {
    return this.storageKeyPrefix + environment.accessPassphraseHash;
  }

  private readStoredUnlock(): boolean {
    try { return localStorage.getItem(this.storageKey()) === 'true'; }
    catch { return false; }
  }

  private writeStoredUnlock(): void {
    try { localStorage.setItem(this.storageKey(), 'true'); }
    catch { /* storage unavailable (private browsing, etc.) — the gate just reappears next visit */ }
  }

  private async sha256Hex(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
