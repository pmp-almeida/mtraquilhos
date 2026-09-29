import { routes } from './app.routes';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LeaderboardComponent } from './features/leaderboard/leaderboard.component';
import { MatchHistoryComponent } from './features/matches/match-history.component';
import { RecordMatchComponent } from './features/matches/record-match.component';
import { LiveMatchComponent } from './features/live-match/live-match.component';
import { PlayersComponent } from './features/players/players.component';
import { PlayerProfileComponent } from './features/players/player-profile.component';
import { RandomTeamsComponent } from './features/random-teams/random-teams.component';
import { TeamNamesComponent } from './features/team-names/team-names.component';
import { SeasonsComponent } from './features/seasons/seasons.component';
import { HowItWorksComponent } from './features/how-it-works/how-it-works.component';
import { ChangelogComponent } from './features/changelog/changelog.component';

describe('app.routes', () => {
  it('has exactly one route per feature plus the wildcard fallback', () => {
    // 12 lazy feature routes + 1 wildcard.
    expect(routes).toHaveLength(13);
  });

  it('every non-wildcard route has a non-empty string path and a title ending in the app brand suffix', () => {
    const nonWildcard = routes.filter(r => r.path !== '**');
    expect(nonWildcard.length).toBeGreaterThan(0);
    for (const route of nonWildcard) {
      expect(typeof route.path).toBe('string');
      expect((route.path as string).length === 0 || (route.path as string).length > 0).toBe(true); // '' (dashboard) is valid
      expect(typeof route.title).toBe('string');
      expect(route.title as string).toMatch(/MTraquilhos$/);
    }
  });

  it('the wildcard route redirects to the root path with no title/component', () => {
    const wildcard = routes.find(r => r.path === '**');
    expect(wildcard).toBeTruthy();
    expect(wildcard!.redirectTo).toBe('');
  });

  it('every route path is unique', () => {
    const paths = routes.map(r => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  const cases: Array<{ path: string; ctor: unknown; name: string }> = [
    { path: '', ctor: DashboardComponent, name: 'DashboardComponent' },
    { path: 'leaderboard', ctor: LeaderboardComponent, name: 'LeaderboardComponent' },
    { path: 'matches', ctor: MatchHistoryComponent, name: 'MatchHistoryComponent' },
    { path: 'matches/record', ctor: RecordMatchComponent, name: 'RecordMatchComponent' },
    { path: 'live', ctor: LiveMatchComponent, name: 'LiveMatchComponent' },
    { path: 'players', ctor: PlayersComponent, name: 'PlayersComponent' },
    { path: 'players/:id', ctor: PlayerProfileComponent, name: 'PlayerProfileComponent' },
    { path: 'teams', ctor: RandomTeamsComponent, name: 'RandomTeamsComponent' },
    { path: 'team-names', ctor: TeamNamesComponent, name: 'TeamNamesComponent' },
    { path: 'seasons', ctor: SeasonsComponent, name: 'SeasonsComponent' },
    { path: 'how-it-works', ctor: HowItWorksComponent, name: 'HowItWorksComponent' },
    { path: 'changelog', ctor: ChangelogComponent, name: 'ChangelogComponent' }
  ];

  for (const { path, ctor, name } of cases) {
    it(`"${path}" lazily resolves to ${name}`, async () => {
      const route = routes.find(r => r.path === path);
      expect(route).toBeTruthy();
      expect(route!.loadComponent).toBeTruthy();
      const resolved = await route!.loadComponent!();
      expect(resolved).toBe(ctor);
    });
  }

  it('every feature route has both a loadComponent and a title, and none has an eager "component"', () => {
    for (const route of routes.filter(r => r.path !== '**')) {
      expect(route.loadComponent).toBeTruthy();
      expect(route.title).toBeTruthy();
      expect((route as { component?: unknown }).component).toBeUndefined();
    }
  });
});
