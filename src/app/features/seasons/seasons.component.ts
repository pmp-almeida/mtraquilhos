import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Season } from '../../core/models/season';
import { SeasonService } from '../../core/services/season.service';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-seasons',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, MatButtonModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatSnackBarModule
  ],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('seasons.eyebrow') }}</p>
      <h1>{{ i18n.t('seasons.title') }}</h1>
      <p>{{ i18n.t('seasons.subtitle') }}</p>
    </section>

    @if (error) { <p class="tf-error">{{ error }}</p> }

    @if (activeSeason(); as active) {
      <mat-card class="active-card">
        <mat-card-content>
          <mat-chip-set><mat-chip>{{ i18n.t('seasons.active') }}</mat-chip></mat-chip-set>
          <h2>{{ i18n.t('seasons.seasonHeading', { number: active.seasonNumber, name: active.name }) }}</h2>
          <p class="tf-empty">{{ i18n.t('seasons.startedCompression', { date: (active.startedAt | date:'longDate':undefined:i18n.locale()), percent: (active.compressionFactor * 100 | number:'1.0-0') }) }}</p>
        </mat-card-content>
      </mat-card>
    }

    @if (!starting()) {
      <button mat-stroked-button (click)="starting.set(true)">
        <mat-icon aria-hidden="true">military_tech</mat-icon>
        {{ i18n.t('seasons.startNewSeason') }}
      </button>
    } @else {
      <mat-card class="start-card">
        <mat-card-header>
          <mat-card-title>{{ i18n.t('seasons.startNewSeason') }}</mat-card-title>
          <mat-card-subtitle>{{ i18n.t('seasons.startSubtitle') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ i18n.t('seasons.nameLabel') }}</mat-label>
            <input matInput [(ngModel)]="name" [placeholder]="i18n.t('seasons.namePlaceholder')" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ i18n.t('seasons.compressionLabel') }}</mat-label>
            <input matInput type="number" min="0" max="100" [(ngModel)]="compressionPercent" />
            <span matTextSuffix>%</span>
          </mat-form-field>
          <p class="hint">{{ i18n.t('seasons.compressionHint') }}</p>
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ i18n.t('seasons.confirmNameLabel') }}</mat-label>
            <input matInput [(ngModel)]="confirmName" />
          </mat-form-field>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="starting.set(false)">{{ i18n.t('common.cancel') }}</button>
          <button mat-flat-button color="primary" [disabled]="!canConfirm() || saving()" (click)="startSeason()">
            {{ saving() ? i18n.t('seasons.starting') : i18n.t('seasons.startSeason') }}
          </button>
        </mat-card-actions>
      </mat-card>
    }

    <section class="history">
      <h2>{{ i18n.t('seasons.historyTitle') }}</h2>
      @if (!pastSeasons().length) { <p class="tf-empty">{{ i18n.t('seasons.noHistory') }}</p> }
      @for (season of pastSeasons(); track season.id) {
        <mat-card class="history-row">
          <mat-card-content>
            <strong>{{ i18n.t('seasons.seasonHeading', { number: season.seasonNumber, name: season.name }) }}</strong>
            <span class="tf-empty">{{ season.startedAt | date:'mediumDate':undefined:i18n.locale() }} &ndash; {{ season.endedAt ? (season.endedAt | date:'mediumDate':undefined:i18n.locale()) : i18n.t('seasons.present') }}</span>
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: [`
    .heading { max-width: 720px; margin-bottom: 16px; }
    h1 { margin: 8px 0; }
    .active-card { margin-bottom: 16px; }
    .active-card h2 { margin: 8px 0 4px; }
    .start-card { margin-top: 16px; max-width: 480px; }
    .full { width: 100%; }
    .hint { color: var(--mat-sys-on-surface-variant); font-size: 0.82rem; margin: -8px 0 12px; }
    .history { margin-top: 28px; }
    .history-row { margin-bottom: 8px; }
    .history-row mat-card-content { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  `]
})
export class SeasonsComponent {
  private readonly seasonService = inject(SeasonService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  readonly seasons = signal<Season[]>([]);
  readonly starting = signal(false);
  readonly saving = signal(false);
  name = '';
  confirmName = '';
  compressionPercent = 50;
  error = '';

  get activeSeasonComputed(): Season | null { return this.seasons().find(s => s.isActive) ?? null; }
  activeSeason = () => this.activeSeasonComputed;
  pastSeasons = () => this.seasons().filter(s => !s.isActive);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try { this.seasons.set(await this.seasonService.list()); }
    catch { this.error = this.i18n.t('seasons.loadError'); }
  }

  canConfirm(): boolean {
    return this.name.trim().length > 0 && this.confirmName.trim() === this.name.trim();
  }

  async startSeason(): Promise<void> {
    if (!this.canConfirm() || this.saving()) return;
    this.saving.set(true);
    try {
      const result = await this.seasonService.start(this.name.trim(), Math.max(0, Math.min(100, this.compressionPercent)) / 100);
      this.snackBar.open(
        this.i18n.t('seasons.startedToast', { number: result.seasonNumber, name: result.name, count: result.playersCompressed }),
        this.i18n.t('common.close'),
        { duration: 5000 }
      );
      this.starting.set(false);
      this.name = '';
      this.confirmName = '';
      this.compressionPercent = 50;
      await this.refresh();
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('seasons.startError'), this.i18n.t('common.close'), { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
