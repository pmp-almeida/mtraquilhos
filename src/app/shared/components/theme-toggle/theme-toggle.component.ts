import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Single toolbar icon button that flips between the app's dark (default)
 * and light themes. Unlike the language switcher this is a plain binary
 * toggle rather than a menu -- there are only two themes -- so one click
 * is all it takes, with the icon itself showing which theme tapping it
 * would switch *to* (the conventional sun/moon toggle affordance).
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatIconModule, MatIconButton, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      (click)="theme.toggle()"
      [matTooltip]="theme.theme() === 'dark' ? i18n.t('theme.toggleToLight') : i18n.t('theme.toggleToDark')"
      [attr.aria-label]="theme.theme() === 'dark' ? i18n.t('theme.toggleToLight') : i18n.t('theme.toggleToDark')"
    >
      <mat-icon aria-hidden="true">{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
    </button>
  `
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
}
