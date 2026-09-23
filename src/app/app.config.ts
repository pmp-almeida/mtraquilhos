import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withInMemoryScrolling` is what makes routerLink + [fragment] (used by
    // the How It Works page's in-page jump links) actually scroll to the
    // target section, and restores scroll position on back/forward nav.
    // Without it the router updates the URL's #fragment but never scrolls.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideAnimationsAsync()
  ]
};
