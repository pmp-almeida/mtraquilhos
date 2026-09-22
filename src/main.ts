import { registerLocaleData } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import localeEnGb from '@angular/common/locales/en-GB';
import localePtPt from '@angular/common/locales/pt-PT';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Registered under both codes so DatePipe/DecimalPipe can be pointed at
// either locale explicitly at render time (see I18nService) -- the app
// switches language at runtime, so a static bootstrap-time LOCALE_ID alone
// wouldn't update already-open pages the way this app requires.
registerLocaleData(localeEnGb, 'en-GB');
registerLocaleData(localePtPt, 'pt-PT');

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
