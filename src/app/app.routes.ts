import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RecordMatchComponent } from './features/matches/record-match.component';
import { MatchHistoryComponent } from './features/matches/match-history.component';
import { PlayersComponent } from './features/players/players.component';
import { PlayerProfileComponent } from './features/players/player-profile.component';
import { LeaderboardComponent } from './features/leaderboard/leaderboard.component';
import { RandomTeamsComponent } from './features/random-teams/random-teams.component';
import { SeasonsComponent } from './features/seasons/seasons.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Table Football Ranked' },
  { path: 'leaderboard', component: LeaderboardComponent, title: 'Leaderboard · Table Football Ranked' },
  { path: 'matches', component: MatchHistoryComponent, title: 'Match history · Table Football Ranked' },
  { path: 'matches/record', component: RecordMatchComponent, title: 'Record a match · Table Football Ranked' },
  { path: 'players', component: PlayersComponent, title: 'Players · Table Football Ranked' },
  { path: 'players/:id', component: PlayerProfileComponent, title: 'Player profile · Table Football Ranked' },
  { path: 'teams', component: RandomTeamsComponent, title: 'Generate teams · Table Football Ranked' },
  { path: 'seasons', component: SeasonsComponent, title: 'Seasons · Table Football Ranked' },
  { path: '**', redirectTo: '' }
];
