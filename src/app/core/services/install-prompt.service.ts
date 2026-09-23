import { Injectable, signal } from '@angular/core';

/** The non-standard but widely-implemented event Chromium-based browsers fire when a page becomes installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Wraps the browser's `beforeinstallprompt` flow so the app can offer its
 * own "Install app" button instead of relying entirely on a browser's own
 * install UI (which is easy to miss, and iOS Safari doesn't fire this event
 * at all -- there, the button simply never appears and installing stays a
 * manual "Add to Home Screen" step, same as it always was).
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  /** True once the browser has told us the app can be installed and we haven't used or dismissed that prompt yet. */
  readonly available = signal(false);
  private deferredEvent: BeforeInstallPromptEvent | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      // Stop the browser's own mini-infobar so our button is the only prompt shown.
      event.preventDefault();
      this.deferredEvent = event as BeforeInstallPromptEvent;
      this.available.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredEvent = null;
      this.available.set(false);
    });
  }

  /** Shows the browser's native install dialog. Can only be called from a user gesture (e.g. a click handler), and only once per captured event. */
  async promptInstall(): Promise<void> {
    const event = this.deferredEvent;
    if (!event) return;
    this.deferredEvent = null;
    this.available.set(false);
    await event.prompt();
    await event.userChoice;
  }
}
