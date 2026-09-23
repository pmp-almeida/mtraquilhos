import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'MTraquilhos'
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
    title: 'Leaderboard · MTraquilhos'
  },
  {
    path: 'matches',
    loadComponent: () => import('./features/matches/match-history.component').then(m => m.MatchHistoryComponent),
    title: 'Match history · MTraquilhos'
  },
  {
    path: 'matches/record',
    loadComponent: () => import('./features/matches/record-match.component').then(m => m.RecordMatchComponent),
    title: 'Record a match · MTraquilhos'
  },
  {
    path: 'live',
    loadComponent: () => import('./features/live-match/live-match.component').then(m => m.LiveMatchComponent),
    title: 'Live Match · MTraquilhos'
  },
  {
    path: 'players',
    loadComponent: () => import('./features/players/players.component').then(m => m.PlayersComponent),
    title: 'Players · MTraquilhos'
  },
  {
    path: 'players/:id',
    loadComponent: () => import('./features/players/player-profile.component').then(m => m.PlayerProfileComponent),
    title: 'Player profile · MTraquilhos'
  },
  {
    path: 'teams',
    loadComponent: () => import('./features/random-teams/random-teams.component').then(m => m.RandomTeamsComponent),
    title: 'Generate teams · MTraquilhos'
  },
  {
    path: 'team-names',
    loadComponent: () => import('./features/team-names/team-names.component').then(m => m.TeamNamesComponent),
    title: 'Team names · MTraquilhos'
  },
  {
    path: 'seasons',
    loadComponent: () => import('./features/seasons/seasons.component').then(m => m.SeasonsComponent),
    title: 'Seasons · MTraquilhos'
  },
  {
    path: 'how-it-works',
    loadComponent: () => import('./features/how-it-works/how-it-works.component').then(m => m.HowItWorksComponent),
    title: 'How ranking works · MTraquilhos'
  },
  { path: '**', redirectTo: '' }
];
