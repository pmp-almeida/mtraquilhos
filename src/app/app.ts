import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccessGateService } from './core/services/access-gate.service';
import { PassphraseGateComponent } from './shared/components/passphrase-gate/passphrase-gate.component';
import { I18nService } from './core/i18n/i18n.service';
import { TranslationKey } from './core/i18n/en-gb';
import { LanguageSwitcherComponent } from './shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatTooltipModule,
    PassphraseGateComponent, LanguageSwitcherComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly gate = inject(AccessGateService);
  protected readonly i18n = inject(I18nService);

  protected readonly navLinks: { path: string; labelKey: TranslationKey; icon: string }[] = [
    { path: '/leaderboard', labelKey: 'nav.leaderboard', icon: 'leaderboard' },
    { path: '/matches', labelKey: 'nav.matches', icon: 'history' },
    { path: '/matches/record', labelKey: 'nav.recordMatch', icon: 'add_circle' },
    { path: '/players', labelKey: 'nav.players', icon: 'group' },
    { path: '/teams', labelKey: 'nav.teams', icon: 'shuffle' },
    { path: '/seasons', labelKey: 'nav.seasons', icon: 'military_tech' }
  ];
}
