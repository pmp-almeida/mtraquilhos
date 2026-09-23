import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AccessGateService } from '../../../core/services/access-gate.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-passphrase-gate',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, LanguageSwitcherComponent, ThemeToggleComponent],
  template: `
    <div class="gate">
      <div class="gate-lang"><app-theme-toggle /><app-language-switcher /></div>
      <mat-card class="gate-card">
        <mat-card-header>
          <mat-card-title>{{ i18n.t('app.brand') }}</mat-card-title>
          <mat-card-subtitle>{{ i18n.t('gate.subtitle') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="hint">{{ i18n.t('gate.hint') }}</p>
          <form (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>{{ i18n.t('gate.passphraseLabel') }}</mat-label>
              <input matInput type="password" name="passphrase" [(ngModel)]="passphrase" autocomplete="off" />
            </mat-form-field>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button mat-flat-button color="primary" type="submit" class="full" [disabled]="checking() || !passphrase.trim()">
              {{ checking() ? i18n.t('gate.checking') : i18n.t('gate.enter') }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .gate {
      position: relative;
      min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px;
      background: radial-gradient(circle at top, color-mix(in srgb, var(--mat-sys-primary) 20%, var(--mat-sys-surface)) 0%, var(--mat-sys-surface) 65%);
    }
    .gate-lang { position: absolute; top: 16px; right: 16px; }
    .gate-card { width: 100%; max-width: 380px; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; margin: 4px 0 18px; }
    .full { width: 100%; }
    .error { color: var(--mat-sys-error); margin: 4px 0 12px; font-size: 0.9rem; }
  `]
})
export class PassphraseGateComponent {
  private readonly gate = inject(AccessGateService);
  protected readonly i18n = inject(I18nService);
  passphrase = '';
  readonly checking = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    if (!this.passphrase.trim() || this.checking()) return;
    this.checking.set(true);
    this.error.set('');
    try {
      const ok = await this.gate.tryUnlock(this.passphrase);
      if (!ok) this.error.set(this.i18n.t('gate.incorrect'));
    } finally {
      this.checking.set(false);
      this.passphrase = '';
    }
  }
}
