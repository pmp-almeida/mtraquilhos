import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AccessGateService } from '../../../core/services/access-gate.service';

@Component({
  selector: 'app-passphrase-gate',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="gate">
      <mat-card class="gate-card">
        <mat-card-header>
          <mat-card-title>Table Football Ranked</mat-card-title>
          <mat-card-subtitle>Enter the shared passphrase to continue</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="hint">
            This is a lightweight shared gate, not an account system &mdash;
            everyone on the team enters the same passphrase.
          </p>
          <form (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Passphrase</mat-label>
              <input matInput type="password" name="passphrase" [(ngModel)]="passphrase" autocomplete="off" />
            </mat-form-field>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button mat-flat-button color="primary" type="submit" class="full" [disabled]="checking() || !passphrase.trim()">
              {{ checking() ? 'Checking…' : 'Enter' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .gate {
      min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px;
      background: radial-gradient(circle at top, color-mix(in srgb, var(--mat-sys-primary) 20%, var(--mat-sys-surface)) 0%, var(--mat-sys-surface) 65%);
    }
    .gate-card { width: 100%; max-width: 380px; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; margin: 4px 0 18px; }
    .full { width: 100%; }
    .error { color: var(--mat-sys-error); margin: 4px 0 12px; font-size: 0.9rem; }
  `]
})
export class PassphraseGateComponent {
  private readonly gate = inject(AccessGateService);
  passphrase = '';
  readonly checking = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    if (!this.passphrase.trim() || this.checking()) return;
    this.checking.set(true);
    this.error.set('');
    try {
      const ok = await this.gate.tryUnlock(this.passphrase);
      if (!ok) this.error.set('That passphrase is not correct.');
    } finally {
      this.checking.set(false);
      this.passphrase = '';
    }
  }
}
