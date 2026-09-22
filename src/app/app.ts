import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccessGateService } from './core/services/access-gate.service';
import { PassphraseGateComponent } from './shared/components/passphrase-gate/passphrase-gate.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, RouterOutlet,
    MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatTooltipModule,
    PassphraseGateComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly gate = inject(AccessGateService);

  protected readonly navLinks = [
    { path: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
    { path: '/matches', label: 'Matches', icon: 'history' },
    { path: '/players', label: 'Players', icon: 'group' },
    { path: '/teams', label: 'Generate teams', icon: 'shuffle' },
    { path: '/seasons', label: 'Seasons', icon: 'military_tech' }
  ];
}
