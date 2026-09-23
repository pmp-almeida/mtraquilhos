import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { CHANGELOG } from '../../core/changelog/changelog';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Full release history (spec section 27's "keep the important information
 * immediately understandable" applies here too -- newest first, one card
 * per release). Every version's copy lives in CHANGELOG (core/changelog)
 * as translation keys, so this component is pure rendering: adding a new
 * release means editing that data file, not this one.
 */
@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [MatCardModule, MatChipsModule, MatIconModule],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('changelog.eyebrow') }}</p>
      <h1>{{ i18n.t('changelog.title') }}</h1>
      <p>{{ i18n.t('changelog.subtitle') }}</p>
    </section>

    <ol class="timeline">
      @for (release of releases; track release.version; let first = $first) {
        <li class="entry">
          <div class="rail">
            <span class="dot" [class.current]="first"></span>
            <span class="line"></span>
          </div>
          <mat-card class="release-card">
            <mat-card-header>
              <mat-card-title>
                <span class="version">v{{ release.version }}</span>
                <span class="release-title">{{ i18n.t(release.titleKey) }}</span>
                @if (first) { <span class="current-chip">{{ i18n.t('changelog.currentBadge') }}</span> }
              </mat-card-title>
              <mat-card-subtitle>{{ release.date }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p class="group-label">{{ i18n.t('changelog.featuresLabel') }}</p>
              <ul class="feature-list">
                @for (key of release.featureKeys; track key) {
                  <li><mat-icon aria-hidden="true">add_circle</mat-icon><span>{{ i18n.t(key) }}</span></li>
                }
              </ul>
              @if (release.fixKeys?.length) {
                <p class="group-label fixes">{{ i18n.t('changelog.fixesLabel') }}</p>
                <ul class="feature-list fixes">
                  @for (key of release.fixKeys ?? []; track key) {
                    <li><mat-icon aria-hidden="true">build</mat-icon><span>{{ i18n.t(key) }}</span></li>
                  }
                </ul>
              }
            </mat-card-content>
          </mat-card>
        </li>
      }
    </ol>
  `,
  styles: [`
    :host { display: block; }
    .heading { margin-bottom: 24px; max-width: 640px; }
    h1 { margin: 8px 0; }
    .timeline { list-style: none; margin: 0; padding: 0; }
    .entry { display: grid; grid-template-columns: 20px 1fr; gap: 16px; }
    .rail { display: flex; flex-direction: column; align-items: center; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--mat-sys-outline-variant); margin-top: 22px; flex: none; }
    .dot.current { background: var(--mat-sys-primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--mat-sys-primary) 20%, transparent); }
    .line { flex: 1; width: 2px; background: var(--mat-sys-outline-variant); margin: 4px 0; }
    .entry:last-child .line { display: none; }
    .release-card { margin-bottom: 20px; }
    mat-card-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .version { font-variant-numeric: tabular-nums; color: var(--mat-sys-primary); font-weight: 700; }
    .release-title { font-weight: 600; }
    .current-chip { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--mat-sys-primary) 18%, transparent); color: var(--mat-sys-primary); }
    .group-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--mat-sys-on-surface-variant); font-weight: 700; margin: 14px 0 6px; }
    .group-label.fixes { color: var(--mat-sys-tertiary); }
    .feature-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .feature-list li { display: flex; align-items: flex-start; gap: 8px; }
    .feature-list mat-icon { font-size: 18px; width: 18px; height: 18px; margin-top: 2px; color: var(--mat-sys-primary); flex: none; }
    .feature-list.fixes mat-icon { color: var(--mat-sys-tertiary); }
  `]
})
export class ChangelogComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly releases = CHANGELOG;
}
