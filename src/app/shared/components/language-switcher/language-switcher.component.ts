import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { Locale, LOCALE_LABELS, SUPPORTED_LOCALES } from '../../../core/i18n/locale';

/**
 * Toolbar language switcher. Selecting a language calls I18nService.setLocale(),
 * which updates the `locale` signal every template in the app reads through
 * `i18n.t()` -- so every open screen re-renders in the new language
 * immediately, with no navigation and no reload.
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button
      mat-button
      class="lang-trigger"
      [matMenuTriggerFor]="langMenu"
      [matTooltip]="i18n.t('lang.label')"
      [attr.aria-label]="i18n.t('lang.label')"
    >
      <mat-icon aria-hidden="true">translate</mat-icon>
      <span class="lang-code">{{ shortCode(i18n.locale()) }}</span>
    </button>
    <mat-menu #langMenu="matMenu">
      @for (locale of locales; track locale) {
        <button mat-menu-item (click)="i18n.setLocale(locale)" [class.active]="i18n.locale() === locale">
          <mat-icon aria-hidden="true">{{ i18n.locale() === locale ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
          <span>{{ labels[locale] }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: [`
    .lang-trigger { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 0 10px; }
    .lang-trigger mat-icon { margin: 0; }
    .lang-code { font-weight: 700; font-size: 0.78rem; letter-spacing: 0.03em; }
    .mat-mdc-menu-item.active { color: var(--mat-sys-primary); }
  `]
})
export class LanguageSwitcherComponent {
  readonly i18n = inject(I18nService);
  readonly locales = SUPPORTED_LOCALES;
  readonly labels = LOCALE_LABELS;

  shortCode(locale: Locale): string {
    return locale === 'pt-PT' ? 'PT' : 'EN';
  }
}
