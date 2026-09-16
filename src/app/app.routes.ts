import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RecordMatchComponent } from './features/matches/record-match.component';
import { PlayersComponent } from './features/players/players.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'matches/record', component: RecordMatchComponent },
  { path: 'players', component: PlayersComponent },
  { path: '**', redirectTo: '' }
];
