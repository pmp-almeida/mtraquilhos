import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Table Football Ranked'
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
    title: 'Leaderboard · Table Football Ranked'
  },
  {
    path: 'matches',
    loadComponent: () => import('./features/matches/match-history.component').then(m => m.MatchHistoryComponent),
    title: 'Match history · Table Football Ranked'
  },
  {
    path: 'matches/record',
    loadComponent: () => import('./features/matches/record-match.component').then(m => m.RecordMatchComponent),
    title: 'Record a match · Table Football Ranked'
  },
  {
    path: 'live',
    loadComponent: () => import('./features/live-match/live-match.component').then(m => m.LiveMatchComponent),
    title: 'Live Match · Table Football Ranked'
  },
  {
    path: 'players',
    loadComponent: () => import('./features/players/players.component').then(m => m.PlayersComponent),
    title: 'Players · Table Football Ranked'
  },
  {
    path: 'players/:id',
    loadComponent: () => import('./features/players/player-profile.component').then(m => m.PlayerProfileComponent),
    title: 'Player profile · Table Football Ranked'
  },
  {
    path: 'teams',
    loadComponent: () => import('./features/random-teams/random-teams.component').then(m => m.RandomTeamsComponent),
    title: 'Generate teams · Table Football Ranked'
  },
  {
    path: 'seasons',
    loadComponent: () => import('./features/seasons/seasons.component').then(m => m.SeasonsComponent),
    title: 'Seasons · Table Football Ranked'
  },
  {
    path: 'how-it-works',
    loadComponent: () => import('./features/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent),
    title: 'How ranking works · Table Football Ranked'
  },
  { path: '**', redirectTo: '' }
];
