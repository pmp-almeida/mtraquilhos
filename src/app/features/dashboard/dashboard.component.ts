import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, RouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">COMPETITIVE TABLE FOOTBALL</p>
      <h1>Play. Rank up. Repeat.</h1>
      <p class="subtitle">Track Elo, ranks, placements, and every 2v2 match in one place.</p>
      <button mat-flat-button color="primary" routerLink="/matches/record">Record a match</button>
      <button mat-button routerLink="/players">Manage players</button>
    </section>
    <section class="cards">
      <mat-card><mat-card-header><mat-card-title>Players</mat-card-title></mat-card-header><mat-card-content><strong>0</strong> active players</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Matches</mat-card-title></mat-card-header><mat-card-content><strong>0</strong> recorded matches</mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>Leaderboard</mat-card-title></mat-card-header><mat-card-content>Build your ranking through five placement matches.</mat-card-content></mat-card>
    </section>
  `,
  styles: [`
    .hero { padding: 48px 0 32px; max-width: 720px; }
    .eyebrow { color: var(--mat-sys-primary); font-weight: 700; letter-spacing: .12em; }
    h1 { font-size: clamp(2.2rem, 6vw, 4.5rem); line-height: 1; margin: 12px 0; }
    .subtitle { font-size: 1.15rem; margin-bottom: 28px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    strong { font-size: 2rem; }
    @media (max-width: 720px) { .cards { grid-template-columns: 1fr; } .hero { padding-top: 24px; } }
  `]
})
export class DashboardComponent {}