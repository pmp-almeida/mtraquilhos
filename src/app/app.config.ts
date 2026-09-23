import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withInMemoryScrolling` is what makes routerLink + [fragment] (used by
    // the How It Works page's in-page jump links) actually scroll to the
    // target section, and restores scroll position on back/forward nav.
    // Without it the router updates the URL's #fragment but never scrolls.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideAnimationsAsync(),
    // Registers the build's service worker in production only, once the app
    // has been stable for 30s so it never competes with initial page load
    // for bandwidth/CPU -- this is what makes the app installable and lets
    // it keep working (from cache) if the network drops mid-session.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
