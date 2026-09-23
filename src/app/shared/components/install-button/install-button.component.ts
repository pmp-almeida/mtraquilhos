import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { InstallPromptService } from '../../../core/services/install-prompt.service';

/**
 * Toolbar "Install app" button. Renders nothing until the browser reports
 * (via `beforeinstallprompt`) that the app is actually installable -- so on
 * a browser that doesn't support the prompt (Safari, Firefox) or once the
 * app is already installed, this button simply isn't in the DOM at all
 * rather than showing a button that would do nothing when tapped.
 */
@Component({
  selector: 'app-install-button',
  standalone: true,
  imports: [MatIconModule, MatIconButton, MatTooltipModule],
  template: `
    @if (install.available()) {
      <button
        mat-icon-button
        (click)="install.promptInstall()"
        [matTooltip]="i18n.t('pwa.installLabel')"
        [attr.aria-label]="i18n.t('pwa.installLabel')"
      >
        <mat-icon aria-hidden="true">install_mobile</mat-icon>
      </button>
    }
  `
})
export class InstallButtonComponent {
  protected readonly install = inject(InstallPromptService);
  protected readonly i18n = inject(I18nService);
}
