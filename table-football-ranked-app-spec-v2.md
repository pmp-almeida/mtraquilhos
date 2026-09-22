# Table Football Ranked — Application Generation Specification

## 1. Project Overview

Build a lightweight, game-like ranking application for a private group that plays table football regularly.

Matches are always **2v2**, with teams formed randomly. Each player has an individual Elo rating. Elo determines the player's rank and RR progression.

The application should feel similar to a competitive video game ranking system:

- Individual Elo rating underneath
- Tier + division on top
- 0–100 RR-style progression
- Automatic rank-ups
- Automatic demotions
- One-use Demotion Shield
- Leaderboard
- Match history
- Player statistics
- Teammate statistics

The application does **not** use user authentication.

---

# 2. Technology Stack

Use:

- Angular
- TypeScript
- Angular Material
- Supabase
- GitHub Pages
- GitHub Actions for deployment

Use the current stable Angular version available when implementing the project.

The application should be responsive and work well on desktop and mobile.

---

# 3. Authentication

There is **no user authentication**.

Do not implement:

- Login
- Signup
- Password reset
- Auth guards
- Supabase Auth
- User accounts
- `auth_user_id`

The application opens directly to the main dashboard.

Because there is no authentication, database-side integrity is important. Match processing and rating calculations must happen server-side through a Supabase database function/RPC rather than trusting calculations performed by the Angular client.

The application is intended for private use by people who have access to the application URL.

---

# 4. Player Model

Each player has:

- `id`
- `display_name`
- `starting_elo`
- `current_elo`
- `peak_elo`
- `visible_rank`
- `rr`
- `demotion_shield_active`
- `demotion_pending`
- `active`
- `created_at`

Every new player starts **Unranked** and must complete **10 placement matches** before receiving a visible rank.

During placements:

- Starting Elo: **520**
- Visible Rank: **Unranked**
- RR: not displayed
- Demotion Shield: inactive
- Demotion pending: false
- Placement matches played: `0/10`

The 520 starting Elo is the hidden rating baseline. It is used by the Elo system during placement matches.

After the player's tenth placement match, their current Elo is converted into their initial visible rank and RR using the normal rank/RR thresholds defined below.

The initial placement result is therefore determined by the player's performance across the 10 placement matches rather than by immediately assigning Iron I.

---

# 5. Elo System

Use standard Elo.

## Constants

```text
Starting Elo = 520
K-factor = 32
```

Every match is 2v2.

## Team Elo

Team Elo is the arithmetic average of the two teammates' **pre-match Elo**.

```text
Team A Elo = (Player A1 Elo + Player A2 Elo) / 2
Team B Elo = (Player B1 Elo + Player B2 Elo) / 2
```

Do not round team Elo before calculating expected probabilities.

---

# 6. Expected Win Probability

For Team A:

```text
EA = 1 / (1 + 10 ^ ((TeamB_Elo - TeamA_Elo) / 400))
```

For Team B:

```text
EB = 1 - EA
```

---

# 7. Elo Change

If Team A wins:

```text
DeltaA = round(32 * (1 - EA))
DeltaB = -DeltaA
```

If Team B wins:

```text
DeltaB = round(32 * (1 - EB))
DeltaA = -DeltaB
```

Both players on the same team receive the **same signed Elo delta**.

Example:

```text
Team A:
Player 1: 500 Elo
Player 2: 540 Elo

Team B:
Player 3: 580 Elo
Player 4: 620 Elo
```

Team A Elo:

```text
520
```

Team B Elo:

```text
600
```

If Team A wins, both Team A players receive the same positive Elo delta and both Team B players receive the same negative Elo delta.

---

# 8. Upsets

Do not implement a separate upset bonus.

The Elo formula naturally makes upsets worth more:

- A lower-rated team beating a higher-rated team gains more Elo.
- A higher-rated team beating a lower-rated team gains less Elo.

This is the intended behavior.

---

# 9. Match Score

The actual football score does **not** affect Elo.

For example:

```text
10–0
```

and:

```text
10–9
```

are both simply a win/loss for rating purposes.

The actual score may optionally be stored for future statistics, but it must not affect Elo.

---

# 10. Rank System

There are 9 tiers:

```text
Lixo
Iron
Bronze
Silver
Gold
Platinum
Diamond
Emerald
Champion
```

All tiers except Lixo and Champion have three divisions:

```text
I
II
III
```

Division ordering:

```text
I = lowest
II = middle
III = highest
```

Progression is:

```text
Iron I
→ Iron II
→ Iron III
→ Bronze I
→ Bronze II
→ Bronze III
→ Silver I
→ Silver II
→ Silver III
→ Gold I
→ Gold II
→ Gold III
→ Platinum I
→ Platinum II
→ Platinum III
→ Diamond I
→ Diamond II
→ Diamond III
→ Emerald I
→ Emerald II
→ Emerald III
→ Champion
```

Lixo is below Iron I.

---

# 11. Rank/Elo Thresholds

Use 40 Elo points per normal division.

The new rating scale is:

| Rank | Elo Range |
|---|---:|
| Lixo | `< 500` |
| Iron I | `500–539` |
| Iron II | `540–579` |
| Iron III | `580–619` |
| Bronze I | `620–659` |
| Bronze II | `660–699` |
| Bronze III | `700–739` |
| Silver I | `740–779` |
| Silver II | `780–819` |
| Silver III | `820–859` |
| Gold I | `860–899` |
| Gold II | `900–939` |
| Gold III | `940–979` |
| Platinum I | `980–1019` |
| Platinum II | `1020–1059` |
| Platinum III | `1060–1099` |
| Diamond I | `1100–1139` |
| Diamond II | `1140–1179` |
| Diamond III | `1180–1219` |
| Emerald I | `1220–1259` |
| Emerald II | `1260–1299` |
| Emerald III | `1300–1339` |
| Champion | `1340+` |

Lixo is only available below 500 Elo.

Champion starts at 1340 Elo.

---

# 12. RR System

Every normal division has:

```text
0–100 RR
```

RR is derived from the player's Elo within the current 40-Elo division.

Formula:

```text
RR = floor(((Elo - DivisionFloor) / 40) * 100)
```

Clamp RR to:

```text
0–99
```

Never display 100 RR.

## Placement Players

The hidden starting Elo is:

```text
520 Elo
```

A new player is **Unranked**, so they do not receive RR while completing placements.

After the tenth placement match, calculate the player's rank from their resulting Elo using the normal thresholds.

If the resulting Elo is 520, for example:

```text
520 Elo → Iron I, 50 RR
```

Thus 520 Elo remains the canonical baseline for the ranking system, but it is no longer an automatic starting rank.

The player must complete all 10 placement matches before this rank becomes visible.

## Examples

Iron I:

```text
500 Elo → Iron I, 0 RR
510 Elo → Iron I, 25 RR
520 Elo → Iron I, 50 RR
530 Elo → Iron I, 75 RR
539 Elo → Iron I, 97 RR
540 Elo → Iron II, 0 RR
```

Gold I:

```text
860 Elo → Gold I, 0 RR
870 Elo → Gold I, 25 RR
880 Elo → Gold I, 50 RR
890 Elo → Gold I, 75 RR
900 Elo → Gold II, 0 RR
```

---

# 13. Placement Matches

Every new player must complete exactly **10 placement matches** before becoming ranked.

## Placement State

A player is considered unranked while:

```text
placement_matches_played < 10
```

Display:

```text
Unranked
Placement Matches: X/10
```

Do not display a normal tier, division, or RR during placements.

The player's hidden/current Elo is still updated normally after every placement match using the standard 2v2 Elo system.

## Placement Match Processing

Placement matches use exactly the same Elo rules as regular matches:

- Starting Elo = 520
- K-factor = 32
- Team Elo = average of the two teammates
- Expected probability uses the standard Elo formula
- Same Elo delta for both teammates
- Upsets naturally produce larger Elo changes
- Score margin does not affect Elo

There is no special placement multiplier.

After each placement match:

```text
placement_matches_played += 1
```

After the tenth placement match:

```text
placement_complete = true
```

Then calculate the player's initial visible rank and RR from their resulting Elo.

## Example

A player starts:

```text
Unranked
520 Elo
0/10 placements
```

After ten matches their Elo is:

```text
548 Elo
```

Their initial rank becomes:

```text
Iron II
20 RR
548 Elo
```

If their final placement Elo is:

```text
520 Elo
```

their initial rank becomes:

```text
Iron I
50 RR
520 Elo
```

If their final placement Elo is:

```text
480 Elo
```

their initial rank becomes:

```text
Lixo
0 RR
480 Elo
```

If their final placement Elo is:

```text
1340+ Elo
```

their initial rank becomes:

```text
Champion
0 RR
```

There is no placement-specific rank floor. A player's first rank is entirely determined by their Elo after the tenth placement match.

## Placement UI

The player profile should clearly show:

```text
Unranked

Placement Matches
3 / 10

Current Elo
548
```

After the tenth placement:

```text
Placement Complete

Iron II
20 RR

548 Elo
```

The transition from Unranked to the initial rank should be presented as a clear result/reveal.

## Placement Restrictions

While unranked:

- Do not show a Demotion Shield.
- Do not show a demotion warning.
- Do not process demotions.
- Do not show normal RR progression.
- Do not treat the player as ranked in rank-based UI filters unless explicitly requested.

Placement matches still count toward:

- Wins
- Losses
- Win rate
- Total matches
- Teammate statistics
- Elo history

## Placement Match History

Placement matches should be stored exactly like regular matches and clearly marked as placement matches.

Add:

```text
is_placement_match
```

to the match model.

A placement match should show:

```text
Placement Match 3/10
```

in the match history.

Once the tenth placement match is complete, subsequent matches are regular ranked matches.

---

# 14. Rank Ups

Rank-ups happen automatically when Elo reaches the next division threshold.

There is no promotion match.

There is no promotion match.

Example:

```text
Iron I
539 Elo
97 RR
```

If the player's match increases their Elo to:

```text
545 Elo
```

their resulting rank is:

```text
Iron II
12 RR
545 Elo
```

The same applies across all divisions and tiers.

---

# 14. Lixo

Lixo is only available below:

```text
500 Elo
```

Lixo has:

- No division
- 0 RR
- No internal RR progression

Example:

```text
499 Elo → Lixo
```

At:

```text
500 Elo → Iron I, 0 RR
```

---

# 15. Champion

Champion starts at:

```text
1340 Elo
```

Champion has:

- No division
- 0 RR

Examples:

```text
1340 Elo → Champion
1400 Elo → Champion
1500 Elo → Champion
```

For leaderboard purposes, Champion players should be ordered by Elo.

---

# 18. Demotion Shield

Each **ranked** player can have a **one-use Demotion Shield**.

Players who are still Unranked and completing placement matches do not have a Demotion Shield.

The shield protects the player's **visible rank**, not their Elo.

The Elo calculation must never be altered because of the shield.

## Trigger

When a player reaches or falls below the Elo floor of their current division, the Demotion Shield activates instead of immediately changing the visible rank.

Example:

```text
Gold II
900 Elo
0 RR
```

The player loses and their Elo becomes:

```text
894 Elo
```

Normally this would be:

```text
Gold I
85 RR
```

With the Demotion Shield:

```text
Visible Rank: Gold II
RR: 0
Underlying Elo: 894
Demotion Shield: Active
Demotion Pending: true
```

The underlying Elo must remain 894.

---

# 19. Demotion Match

After a Demotion Shield activates, the next match is a **demotion match**.

## If the player wins

- The player retains the protected visible rank.
- The Demotion Shield is consumed.
- `demotion_shield_active = false`
- `demotion_pending = false`
- The player's Elo remains whatever the normal Elo calculation produced.
- After the shield is consumed, future rank calculations use the normal Elo thresholds.

## If the player loses

- The player is immediately demoted to the next lower division.
- The Demotion Shield is consumed.
- `demotion_shield_active = false`
- `demotion_pending = false`
- The player's Elo remains the normally calculated Elo.

Do not modify Elo specifically to force a rank outcome.

---

# 20. Demotion Floor Cases

For a player in:

```text
Iron I
```

there is no lower normal division.

If their Elo falls below 500, their rank becomes:

```text
Lixo
```

The Demotion Shield must not prevent a player from eventually reaching Lixo.

For a player in Lixo, no demotion exists.

For Champion, there is no Demotion Shield requirement unless explicitly added later; Champion has no division below it within the Champion tier, but falling below 1340 Elo follows the normal threshold system into Emerald III.

---

# 21. Rank State

Because Demotion Shield can temporarily make visible rank differ from raw Elo, store rank state explicitly.

Recommended fields:

```text
visible_rank
rr
demotion_shield_active
demotion_pending
```

Do not calculate the displayed rank purely from `current_elo` in the frontend.

The backend must be authoritative.

---

# 22. Player Statistics

Each player profile should show:

## Core

- Current Rank
- RR
- Current Elo
- Peak Elo
- Wins
- Losses
- Total Matches
- Win %

## Streaks

- Current Win Streak
- Best Win Streak
- Current Loss Streak

## Elo statistics

- Biggest Elo Gain
- Biggest Elo Loss

## Teammate statistics

- Best Teammate
- Worst Teammate

---

# 23. Best Teammate

For every other player, calculate historical performance when the two players were teammates.

For each teammate:

```text
matches_together
wins_together
losses_together
win_rate_together
```

Primary metric:

```text
Teammate Win Rate
```

Only include teammates with at least:

```text
5 matches together
```

This avoids a single match determining Best/Worst Teammate.

Example:

| Teammate | Matches | Wins | Losses | Win Rate |
|---|---:|---:|---:|---:|
| João | 20 | 15 | 5 | 75% |
| Pedro | 30 | 18 | 12 | 60% |
| Rui | 10 | 3 | 7 | 30% |

Best Teammate:

```text
João — 75%
```

---

# 24. Worst Teammate

Worst Teammate uses exactly the same dataset and minimum-match requirement.

The Worst Teammate is the teammate with the lowest historical win rate when playing together.

Example:

```text
Worst Teammate
Rui — 30%
10 matches together
```

If nobody has played at least 5 matches together:

```text
Best Teammate: —
Worst Teammate: —
```

These statistics are descriptive historical statistics only.

---

# 25. Teammate Tie Breaking

When two teammates have the same win rate:

1. Prefer the teammate with more matches together.
2. If still tied, prefer the teammate with more wins.
3. If still tied, sort alphabetically by player name.

This makes Best/Worst Teammate deterministic.

---

# 26. Teammate Statistics Table

Each player profile should contain a full teammate table:

| Teammate | Matches | Wins | Losses | Win % |
|---|---:|---:|---:|---:|
| Player A | 15 | 10 | 5 | 66.7% |
| Player B | 12 | 8 | 4 | 66.7% |
| Player C | 8 | 2 | 6 | 25.0% |

At the top of the section display:

```text
Best Teammate
Player A — 66.7%

Worst Teammate
Player C — 25.0%
```

---

# 27. Leaderboard

The main leaderboard should show:

| Rank | Player | Elo | RR | W | L | Win % |
|---|---|---:|---:|---:|---:|---:|

Primary ordering:

```text
Elo descending
```

Useful filters:

- All Players
- Active Players
- Tier
- Rank

Do not use an arbitrary separate leaderboard score.

---

# 28. Match History

Every match must record:

- ID
- Date/time
- Team A players
- Team B players
- Winner
- Optional actual score
- Team A Elo before match
- Team B Elo before match
- Expected Team A probability
- Elo delta
- Individual Elo before/after
- Rank before/after
- RR before/after
- Demotion Shield state before/after
- Optional note
- Created timestamp

Match records should be treated as immutable through the normal UI.

---

# 29. Database Schema

## `players`

```text
id
display_name
starting_elo
current_elo
peak_elo
visible_rank
rr
demotion_shield_active
demotion_pending
placement_matches_played
placement_complete
active
created_at
```

Defaults for a new player:

```text
starting_elo = 520
current_elo = 520
peak_elo = 520
visible_rank = 'Unranked'
rr = null
demotion_shield_active = false
demotion_pending = false
placement_matches_played = 0
placement_complete = false
active = true
```

After the tenth placement match:

```text
placement_matches_played = 10
placement_complete = true
```

At that point, `visible_rank` and `rr` are initialized from the player's resulting Elo.

## `matches`

```text
id
played_at
team_a_player_1
team_a_player_2
team_b_player_1
team_b_player_2
winner
score_a
score_b
team_a_elo
team_b_elo
expected_a
elo_delta
created_at
note
is_placement_match
placement_number
```

`score_a` and `score_b` are optional and have no impact on Elo.

For placement matches:

```text
is_placement_match = true
placement_number = 1..10
```

For regular ranked matches:

```text
is_placement_match = false
placement_number = null
```

## `rating_events`

```text
id
match_id
player_id
elo_before
elo_delta
elo_after
rank_before
rank_after
rr_before
rr_after
demotion_shield_before
demotion_shield_after
demotion_pending_before
demotion_pending_after
placement_matches_before
placement_matches_after
placement_complete_before
placement_complete_after
created_at
```

Constraint:

```text
UNIQUE(match_id, player_id)
```

---

# 30. Server-Side Match RPC

Create a Supabase database function/RPC:

```text
record_match(...)
```

It must:

1. Validate all four players.
2. Ensure the four players are unique.
3. Ensure all players are active.
4. Read authoritative current Elo values.
5. Read current rank/shield state.
6. Calculate Team A Elo.
7. Calculate Team B Elo.
8. Calculate expected probabilities.
9. Calculate Elo changes.
10. Apply identical team deltas to both teammates.
11. Update peak Elo values.
12. Increment placement count when applicable.
13. Determine whether the player has completed their tenth placement.
14. Keep unranked players as `Unranked` with no RR while placements remain incomplete.
15. Reveal the initial rank and RR after placement match 10.
16. Process rank changes for already-ranked players.
17. Process Demotion Shield only for already-ranked players.
18. Calculate resulting RR.
19. Insert the match.
16. Insert four rating events.
17. Commit everything atomically.

If any step fails, roll back the entire operation.

Do not trust Elo values supplied by the Angular client.

---

# 31. Dashboard

The dashboard should contain:

## Leaderboard

Current standings.

## Recent Matches

Latest matches with:

- Teams
- Winner
- Elo changes
- Date

## Quick Stats

Examples:

```text
Total Players
Total Matches
Average Elo
Highest Elo
Most Wins
Highest Win Rate
```

## Main Action

```text
Record Match
```

If the group contains players still completing placements, clearly indicate their placement status in relevant player lists.

Example:

```text
Unranked — 3/10 placements
```

---

# 32. Record Match Screen

Allow the user to select:

```text
Team A Player 1
Team A Player 2

Team B Player 1
Team B Player 2
```

All four players must be distinct.

Winner:

```text
Team A
Team B
```

Optional:

```text
Score
Date/time
Note
```

Before saving, show a confirmation preview.

Example:

```text
Team A
Average Elo: 542

Team B
Average Elo: 587

Expected Team A Win Probability
43.7%

Projected Elo Change
+18 / -18
```

Also show projected changes to:

- Elo
- Rank
- RR
- Demotion Shield state

---

# 33. Random Team Generator

Provide:

```text
Generate Teams
```

Randomly assign active players into 2v2 teams.

Example:

```text
Team A
Player 1
Player 7

Team B
Player 3
Player 5
```

Optional future enhancement:

- Avoid recently repeated teammate pairings.
- Avoid repeating identical teams.

Random team generation has no impact on Elo.

---

# 34. Player Profile

For a ranked player, display:

```text
Player Name

Iron I
50 RR

520 Elo
Peak: 520 Elo
```

For an unranked player, display:

```text
Player Name

Unranked

Placement Matches
3 / 10

520 Elo
Peak: 548 Elo
```

Core statistics:

```text
Wins
Losses
Win Rate
Total Matches
```

Teammate summary:

```text
Best Teammate
Player A — 72.7%

Worst Teammate
Player C — 28.6%
```

Also display:

- Elo history chart
- Match history
- Teammate statistics
- Streak statistics

---

# 35. Angular Material UI

Use Angular Material components including:

- `mat-toolbar`
- `mat-card`
- `mat-table`
- `mat-chip`
- `mat-button`
- `mat-icon-button`
- `mat-dialog`
- `mat-form-field`
- `mat-select`
- `mat-autocomplete`
- `mat-snack-bar`
- `mat-tabs`
- `mat-progress-bar`
- `mat-divider`

The UI should feel:

- Competitive
- Sporty
- Game-like
- Compact
- Clear
- Mobile-friendly

Rank and RR should be visually prominent.

---

# 36. RR Progress Bar

For normal divisions, show RR as a progress bar from 0 to 100.

Example:

```text
Iron I
50 RR

██████████░░░░░░░░░░
```

Do not display 100 RR.

At a rank-up threshold, immediately transition to:

```text
Iron II
0 RR
```

Unranked, Lixo, and Champion should not show a normal RR progress bar.

Unranked should instead show placement progress:

```text
3 / 10 Placement Matches
```


---

# 37. Rank Display

Use a consistent rank object in the application.

Example:

```typescript
interface RankState {
  tier: RankTier | 'Unranked';
  division: RankDivision | null;
  rr: number | null;
}
```

Where:

```typescript
type RankTier =
  | 'Lixo'
  | 'Iron'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Emerald'
  | 'Champion';

type RankDivision = 'I' | 'II' | 'III' | null;
```

---

# 38. Rank Calculation

Create a single shared rank-calculation service/module.

The rank calculation should only produce a normal rank when `placement_complete = true`.

While placements are incomplete, the visible rank must be `Unranked` regardless of current Elo.

It should contain the authoritative thresholds.

Conceptually:

```text
if elo < 500:
    Lixo

else if elo < 540:
    Iron I

else if elo < 580:
    Iron II

...

else if elo < 1340:
    Emerald III

else:
    Champion
```

For normal divisions:

```text
RR = floor(((elo - divisionFloor) / 40) * 100)
```

Clamp to:

```text
0–99
```

Do not duplicate rank logic across Angular components.

The backend must implement the same rules.

---

# 39. Starting State Example

A newly created player must appear as:

```text
Player: New Player
Elo: 520
Rank: Unranked
RR: —
Peak Elo: 520
Wins: 0
Losses: 0
Win Rate: 0%
Best Teammate: —
Worst Teammate: —
Placement Matches: 0 / 10
Demotion Shield: Inactive
```

After ten placement matches, the player's final Elo determines their initial rank.

Example:

```text
Final placement Elo: 520

Rank: Iron I
RR: 50
Placement Matches: 10 / 10
```

This is the canonical placement flow.

---

# 40. Important Boundary Examples

Implement tests for these exact cases:

```text
499 Elo  → Lixo, 0 RR
500 Elo  → Iron I, 0 RR
520 Elo  → Iron I, 50 RR (after placements)
539 Elo  → Iron I, 97 RR (after placements)
540 Elo  → Iron II, 0 RR (after placements)

580 Elo  → Iron III, 0 RR
620 Elo  → Bronze I, 0 RR

860 Elo  → Gold I, 0 RR
880 Elo  → Gold I, 50 RR
900 Elo  → Gold II, 0 RR

980 Elo  → Platinum I, 0 RR
1000 Elo → Platinum I, 50 RR

1220 Elo → Emerald I, 0 RR
1300 Elo → Emerald III, 0 RR
1340 Elo → Champion, 0 RR
```

---

# 41. Testing Requirements

Create automated tests covering:

## Elo

- Starting Elo is 520.
- K-factor is 32.
- Every new player starts Unranked.
- A player remains Unranked until exactly 10 placement matches are completed.
- Placement matches use the normal Elo formula.

- Equal teams produce equal/opposite deltas.
- Upsets produce larger changes.
- Both teammates receive the same delta.
- Team Elo uses pre-match Elo.
- Score margin does not affect Elo.

## Rank

- Every threshold.
- Lixo below 500.
- New player is Unranked before placements are complete.
- Rank is revealed after the tenth placement match.
- Final placement Elo determines the initial rank.

- Iron I begins at 500.
- Champion begins at 1340.
- Correct tier/division assignment.

## RR

- 500 Elo = 0 RR.
- 520 Elo = 50 RR.
- 539 Elo = 97 RR.
- 540 Elo = next division at 0 RR.
- RR never displays 100.
- Lixo and Champion have no RR progression.

## Placement

- Placement count starts at 0.
- Placement count increments exactly once per completed placement match.
- A player becomes ranked after the tenth placement match.
- Placement matches contribute to W/L, win rate, Elo history, and teammate statistics.
- Placement matches cannot trigger demotion.
- Placement matches do not use a Demotion Shield.
- The initial rank and RR are derived from Elo after match 10.

## Demotion Shield

- Shield activates at the division floor.
- Elo continues changing normally.
- Visible rank can temporarily differ from Elo-derived rank.
- Winning the demotion match consumes the shield.
- Losing the demotion match causes demotion.
- Shield never changes the Elo calculation.
- Iron I can eventually demote to Lixo.
- Lixo cannot demote further.

## Teammates

- Correct teammate match count.
- Correct teammate W/L.
- Correct teammate win rate.
- Five-match minimum.
- Correct Best Teammate.
- Correct Worst Teammate.
- Deterministic tie-breaking.

## Transaction Integrity

A failed match operation must not partially modify player Elo, ranks, shields, or history.

---

# 42. Deployment

Deploy the Angular application to GitHub Pages using GitHub Actions.

Supabase configuration should use environment variables.

Only public Supabase credentials intended for browser use may be included in the frontend.

Never include:

```text
SUPABASE_SERVICE_ROLE_KEY
```

or any other secret server credential in the Angular application.

---

# 43. Suggested Application Structure

Use a clean Angular feature structure such as:

```text
src/app/
  core/
    models/
    services/
    guards/
  shared/
    components/
    pipes/
  features/
    dashboard/
    leaderboard/
    players/
    matches/
    random-teams/
  rank/
    rank.service.ts
    rank.constants.ts
    elo.service.ts
    teammate-stats.service.ts
```

Authentication-related modules should not be created.

---

# 44. UX Requirements

The application should make the important information immediately understandable.

For each player, prominently show:

```text
Rank
RR
Elo
```

Use clear visual distinction between:

- Rank-up
- Demotion
- Demotion Shield active
- Demotion pending
- Win
- Loss

After recording a match, show a concise result summary:

```text
Match Recorded

+18 Elo
Iron I → Iron II
50 RR → 12 RR
```

For each of the four players, show their individual result.

---

# 45. Data Integrity Rules

The client must never be able to arbitrarily submit:

- Elo
- Rank
- RR
- Peak Elo
- Elo delta
- Demotion Shield state

These are derived/authoritative fields.

The client submits match information such as:

```text
players
winner
score
date
note
```

The backend calculates the resulting ratings and state.

---

# 46. Final Business Rules Summary

The implementation must follow these rules exactly:

```text
Starting Elo = 520
Starting Rank = Unranked
Placement Matches Required = 10
Starting RR = not displayed during placements

After 10 placement matches:
Rank and RR are derived from current Elo.

At 520 Elo after placements:
Iron I, 50 RR

Lixo = Elo < 500

Iron I = 500–539
Iron II = 540–579
Iron III = 580–619

Bronze I = 620–659
Bronze II = 660–699
Bronze III = 700–739

Silver I = 740–779
Silver II = 780–819
Silver III = 820–859

Gold I = 860–899
Gold II = 900–939
Gold III = 940–979

Platinum I = 980–1019
Platinum II = 1020–1059
Platinum III = 1060–1099

Diamond I = 1100–1139
Diamond II = 1140–1179
Diamond III = 1180–1219

Emerald I = 1220–1259
Emerald II = 1260–1299
Emerald III = 1300–1339

Champion = 1340+

Normal division size = 40 Elo
RR = 0–99
Starting RR = 50

K-factor = 32
Team Elo = average of teammates
Same Elo delta for both teammates
Upsets naturally produce larger Elo changes
Score margin does not affect Elo

Lixo has no divisions
Champion has no divisions

Demotion Shield = one-use
Shield protects visible rank, not Elo

No authentication
```

---

# 47. Primary Objective for the App Generation AI

Generate a complete, working Angular application implementing the specification above.

Prioritize:

1. Correct Elo calculations.
2. Correct rank/RR calculations.
3. Correct placement flow: **Unranked → 10 placement matches → initial rank**.
4. Correct starting hidden Elo of **520**.
5. Correct result of **Iron I / 50 RR when final placement Elo is 520**.
6. Correct Demotion Shield behavior after a player is ranked.
7. Correct 2v2 team handling.
8. Correct Best/Worst Teammate statistics.
9. Atomic server-side match processing.
10. Clean, responsive Angular Material UI.
11. Simple player management without authentication.
12. Reliable GitHub Pages deployment.

Do not simplify or alter the ranking rules without explicit instruction.

---

# 48. Addendum — Demotion Shield Applies to Every Rank (Clarification)

Sections 18–20 describe the Demotion Shield in terms of "divisions," and section 20 originally left Champion's shield behavior open ("no Demotion Shield requirement unless explicitly added later"). This is now resolved:

The Demotion Shield protects **every** rank a player can hold, with no exception:

- Every normal division (Iron I through Emerald III) keeps the original rule: the shield arms when the player's RR reaches 0 (the floor of that division) and their next match would drop them into a lower rank.
- **Iron I → Lixo is included.** A player at Iron I, 0 RR, whose Elo would drop below 500 gets the shield exactly like any other division-floor demotion. (The original reference implementation had a bug that excluded this specific case; it is fixed.)
- **Champion is included.** Champion has no RR, so its "floor" is simply holding Champion at all: the first match that would push a Champion player's Elo below 1340 arms the shield instead of demoting them to Emerald III immediately.
- Lixo still has no shield (there is no lower rank to protect against), and Unranked players still have no shield (they have no visible rank yet).

The demotion-match resolution rule from section 19 is unchanged, but stated more precisely: winning the demotion match retains the *exact* protected rank/RR (or Champion, with no RR), even if the resulting Elo doesn't land back inside that rank's range by itself; losing demotes to whatever rank the resulting Elo now computes to.

---

# 49. Addendum — Seasons

Seasons are implemented as an optional, admin-triggered **soft reset**, modeled on Valorant's Acts: instead of wiping ratings, a new season compresses every active player's Elo toward the group's current mean.

## Behavior

- At most one season is active at a time (`seasons.is_active`).
- Starting a season (`start_season(name, compression_factor)` RPC):
  1. Closes the current season, if any, snapshotting every player's final rank/RR/Elo for that season into `player_season_stats`.
  2. Computes the mean Elo across active players.
  3. For every active player: `new_elo = round(mean + (current_elo - mean) * (1 - compression_factor))`, clamped to a sane floor. `compression_factor` ranges from 0 (no change) to 1 (everyone resets to the mean); 0.5 is a typical soft reset.
  4. Recomputes each ranked player's visible rank/RR from their new Elo using the normal thresholds. Unranked (in-placement) players are left as Unranked.
  5. Clears every player's Demotion Shield state, so everyone starts the season with a fresh, unused shield.
  6. Starts a fresh `player_season_stats` row per player: `starting_elo`, `current_elo`, and `peak_elo` all begin at the post-compression Elo, and `wins`/`losses`/`matches_played` reset to 0 for the season.
- **Lifetime stats are untouched.** `players.peak_elo`, `players.wins`/`losses`, `rating_events`, and `matches` are never modified or deleted by a season reset — only `players.current_elo`, `visible_rank`, `rr`, and the two shield flags change. A season is a ladder refresh, not a data wipe.
- Placement matches are **not** re-required at the start of a new season; only brand-new players (not yet `placement_complete`) go through placements, exactly as outside of a season.
- Every match recorded while a season is active is tagged with that `season_id` (`matches.season_id`, nullable). Matches recorded with no active season — including every match recorded before this feature existed — have a null `season_id` and are treated as "pre-season" history.
- The leaderboard can be viewed by the active season (ordered by `player_season_stats.current_elo`) or all-time (ordered by `players.current_elo`, as originally specified in section 27); section 27's all-time ordering is unchanged and remains the default when no season is active.
- The Seasons page requires typing the season's name a second time before starting it, since the action is immediate and not reversible from the app.

## Schema additions

```text
seasons
  id, season_number, name, started_at, ended_at, is_active, compression_factor, created_at

player_season_stats
  id, season_id, player_id, starting_elo, current_elo, peak_elo,
  final_rank, final_rr, wins, losses, matches_played, created_at, updated_at
  unique (season_id, player_id)

matches.season_id   -- nullable FK to seasons, added to the existing table
```

`start_season` is `SECURITY DEFINER`, granted to `anon`, consistent with this project's no-auth model (section 3): there is no account system to restrict it to, so it is guarded only by the UI's confirmation step and, if configured, the passphrase gate below.

---

# 50. Addendum — Application Access Gate (Passphrase Gate)

This amends section 3 ("Authentication"). Section 3's rules are otherwise unchanged and still apply in full: there is still no login, no signup, no accounts, no Supabase Auth, and no `auth_user_id`. This addendum adds exactly one thing: an optional, lightweight, **shared** passphrase gate in front of the whole app.

- One passphrase, shared by the entire group — not a per-user credential. There is no username, no account, and no concept of "who" unlocked the app.
- Enforced entirely client-side: the build embeds the SHA-256 hash of the configured passphrase; the app hashes what the visitor types and compares hashes in the browser. The plaintext passphrase never appears in the repository, the build output, or over the network.
- A successful unlock is cached in that browser's `localStorage`, keyed by the current hash, so rotating the passphrase invalidates every previous unlock everywhere.
- It is explicitly **not** a security boundary: it does not gate the Supabase RPCs (`record_match`, `start_season`, player creation), which remain callable by anyone with the project's public anon key, exactly as before this addendum. Its only purpose is to stop the app from being stumbled into by someone who has the URL but not the passphrase.
- It is entirely optional and off by default: if the `ACCESS_PASSPHRASE` secret is not configured at deploy time, the app opens directly with no gate, matching the original no-auth behavior described in section 3.

---

# 51. Addendum — Implementation Status Notes

Recording where this pass closed gaps against the original spec, and one deliberate schema deviation:

- **Closed:** Section 32's confirmation preview before saving a match (projected Elo/team win probability) was previously missing from the Record Match screen; it is now implemented as a preview step before submission.
- **Closed:** Section 44's post-match result summary (`+18 Elo`, rank transition, per-player breakdown) was previously missing; it is now shown after a match is recorded, including Demotion Shield state changes.
- **Closed:** Section 33's random team generator had a service (`RandomTeamService`) but no screen. A "Generate teams" page now exists.
- **Closed:** Section 34's Player Profile screen did not exist (only a flat players list did). A full profile page now exists per player: rank, RR, Elo, peak Elo, core stats, streaks, biggest Elo gain/loss, the full teammate table with Best/Worst Teammate, season history, and recent matches.
- **Deviation:** Section 29 suggests `is_placement_match` and `placement_number` columns on the `matches` table. These were not added. A single match can be a placement match for one player and a regular ranked match for their teammates (each player's placement progress advances independently), so a match-level flag cannot represent this correctly. Placement status is instead read per player from `rating_events.placement_matches_before` / `placement_matches_after` (already part of the original schema), which is unambiguous. Section 13's "Placement Match History" requirement — that placement progress is visible and tied to specific matches — is still met, just per player rather than per match.
- **UI framework:** Section 35 is unchanged in substance (Angular Material) but the app now uses a dark, Material 3 "competitive" theme (red primary, tier-colored rank badges modeled loosely on Valorant's rank-color ladder) rather than the default light azure/blue theme, per section 35's "competitive, sporty, game-like" requirement.
- **Fixed (production bug):** `record_match` originally wrote a player's placement-completion flag and their resulting visible rank in two separate `UPDATE` statements. Postgres validates table CHECK constraints at the end of every statement, not just at commit, so the moment any player's placement count first reached the required number, the first `UPDATE` alone produced a row with `placement_complete = true` and `visible_rank` still `'Unranked'` -- violating the section-4 invariant that a player is Unranked if and only if placement is incomplete -- and the entire match was rejected before the second `UPDATE` (which would have set the real rank) ever ran. Every field for a player is now computed first and written in a single `UPDATE`, so the row is only ever checked in its final, consistent state. No historical data was affected, since the failing statement rolled back.

---

# 52. Addendum — Placement Matches Required Raised to 10

Section 4 and section 13 originally required exactly **5** placement matches. This is raised to **10**, effective for every player who has not yet finished placement as of this change; players who already completed placement under the old rule of 5 keep the rank they earned and are not re-placed. Every other placement rule in sections 4, 13, 39, 41, and 46-47 (Elo mechanics, no RR display, no Demotion Shield, contributing to W/L and teammate stats, the reveal-after-completion flow) is unchanged -- only the number 5 becomes 10 everywhere it specified the placement-match count. `PLACEMENT_MATCHES_REQUIRED` in `rank.constants.ts` is the single frontend source of truth; the backend enforces the same number via the `players` table's `placement_matches_played`/`placement_complete` CHECK constraints and inside `record_match` (see `supabase/migrations/20260922160000_placement_matches_ten.sql`).

---

# 53. Addendum — Fixed: Ranked Players Incorrectly Required an Always-Active Demotion Shield

A third bug, uncovered by production testing after the two fixes above: the original `players` table CHECK constraint enforcing section 18's shield rules was written as a biconditional --

```text
(visible_rank = 'Unranked') = (NOT demotion_shield_active)
```

-- rather than the one-directional rule section 18 actually specifies (an Unranked player, who has no rank yet, cannot have an active shield). Because `=` makes both directions mandatory, this constraint also required the reverse: every *ranked* player had to have `demotion_shield_active = true` at all times. Per section 18, the shield is optional and inactive by default, only arming once a ranked player hits a rank floor -- so "ranked with the shield off" is the normal state for nearly every player nearly all the time, and this constraint rejected it outright.

This went undetected through every previous test match because, until section 52's fix, no player had ever actually finished placement and had a match write their row afterward -- every match so far happened while its players were still Unranked, where the constraint's (correct) other half was the only one ever exercised. The first player to complete placement and reach ranked status immediately hit it.

Fixed in `supabase/migrations/20260922162000_fix_ranked_demotion_shield_check.sql`, which replaces the biconditional with `check (not (visible_rank = 'Unranked' and demotion_shield_active))` -- forbidding only the one truly invalid combination and leaving both ranked states (shield on or off) valid.


---

# 54. Addendum — Live Mode

Adds a new screen, `LiveMatchComponent` (route `/live`), for recording a match's score in real time from a single shared device (e.g. one phone propped at the table) instead of only after the fact. This is additive: the existing Record Match screen (section 32) and its `record_match` RPC are unchanged and remain fully supported side by side with Live Mode.

## Device model

Live Mode assumes **one shared scoreboard device** used by whoever is standing at the table, not a per-player synced session. Nothing here introduces realtime sync between multiple phones; that was explicitly considered and deferred (see "Deferred: live visibility elsewhere" below).

## Flow

1. **Setup.** Pick the four players (Team A 1/2, Team B 1/2, all distinct, same validation as Record Match) and a "first to N" target score (default 10).
2. **Live.** The screen becomes a full-viewport, two-zone scoreboard: tapping either half increments that team's score. A single global Undo button removes the last point (from whichever team scored it, restoring exact history order, not just decrementing a total). A close (✕) button asks for confirmation before discarding the whole in-progress match.
3. **Finish prompt.** The moment a team's score reaches the target *and* they are strictly ahead, a bottom sheet appears: "Finish the match?" with the final score and a live-projected Elo change per player (via the same `EloService.project` used by Record Match's preview). Two actions: **Keep playing** (dismisses the prompt for that exact score; it reappears if the score changes again and the finish condition is met again -- e.g. after an Undo and a replay) or **Confirm & finish**, which is the only action that actually submits anything.
4. **Submit.** Confirming calls the exact same `record_match` RPC that Record Match uses, with the final score passed through as `scoreA`/`scoreB` (informational only, per section 9 -- it does not affect Elo; only `winner` does) and a note marking it as recorded via Live Mode. The result screen reuses Record Match's per-player result-row pattern (Elo delta, rank transition, Demotion Shield armed/saved/demoted badges).

Nothing is written to Supabase, and nothing appears on the leaderboard, until step 4's confirm tap. Live Mode makes *entering* a result faster and more natural during play; it does not stream partial scores to the backend or to other viewers.

## Persistence

The in-progress match (player IDs, target score, running score, full point-by-point history, start time) is saved to `localStorage` after every point, under key `tf-live-match-v1`, so a refreshed tab or a phone that locked mid-match resumes exactly where it left off. On load, if any of the four referenced players is no longer active, the saved match is discarded with an explanation rather than resumed into a broken state. The persisted state is cleared the moment the match is confirmed finished or explicitly discarded. This is a client-side convenience only -- it has no bearing on the authoritative match record, which is written exactly once, atomically, by `record_match`.

## Navigation

The toolbar's primary call-to-action and the dashboard's primary hero button now point to Live Match (`bolt` icon) instead of Record Match; Record Match remains one tap away (toolbar nav / mobile menu / dashboard secondary button) for recording a match after the fact.

## Deferred: live visibility elsewhere

A "Live now" indicator -- e.g. a dashboard banner showing an in-progress live match's running score before it's confirmed -- was discussed and deliberately **not** built in this pass. It would need either polling or realtime sync of the in-progress state (currently purely local to the scoreboard device), which is more than this pass's single-device model requires. Noted here as a future idea, not implemented.


---

# 55. Addendum — Fixed: Production Bundle Exceeded GitHub Pages Build Budget

`ng build --configuration production` was failing outright with `[ERROR] bundle initial exceeded maximum budget` (1.05 MB against a 1 MB `maximumError` budget after Live Mode's addition -- Pedro had already hit a smaller 36.55 kB overage before that). This blocks the GitHub Pages deploy workflow entirely, since `.github/workflows/deploy-pages.yml` runs exactly this build and fails the job (and therefore the deploy) on the same error.

## Root cause

Every route in `app.routes.ts` used eager `component:` references, so every feature component (dashboard, leaderboard, matches, players, teams, seasons, live match, and all of Angular Material they pull in) was imported directly by the root route config and bundled into the single initial chunk -- there was no code-splitting at all. The app only ever renders one route at a time, so nearly all of that code was dead weight on every page load.

## Fix

`app.routes.ts` now uses `loadComponent: () => import(...).then(m => m.XComponent)` for every route instead of eager `component:` imports. This is a purely mechanical, behavior-preserving change -- Angular's router lazy-loads the matched route's component (and only that component's own imports) on navigation, code-splitting each feature into its own chunk. No routing behavior, guard, or resolver logic changed.

Result: the initial bundle dropped from 1.05 MB (failing) to 621.82 kB raw / 152.58 kB gzipped -- comfortably under budget, with each feature now its own small lazy chunk (17-45 kB raw) fetched only when its route is visited. `angular.json`'s production `initial` budget was tightened from `500kB`/`1MB` (warning/error) to `650kB`/`900kB` to reflect the new baseline with headroom, rather than leaving stale numbers that no longer mean anything.

This keeps the app on GitHub Pages' free static hosting exactly as originally specified (section 2, section 42) -- no server, no paid tier, no change to the deploy workflow's `cp index.html 404.html` SPA-fallback trick, which still works unchanged since routing itself (path structure, guards) is untouched.


---

# 56. Addendum — Considered: Factoring Match Score (Margin of Victory) into Elo

This documents an analysis Pedro asked for, not an implementation. Nothing in this section changes current behavior; section 9 ("Match Score") still holds exactly as written -- the actual football score has no effect on Elo, only who won does.

## What it would mean

The standard technique (used by, e.g., FiveThirtyEight's NFL/NBA/soccer Elo models) is a margin-of-victory multiplier: instead of `delta = K * (1 - expectedA)`, compute `delta = K * multiplier * (1 - expectedA)`, where the multiplier grows with how lopsided the final score was, damped by a term that shrinks it back down as the result gets more expected -- without that damping term, a big favorite blowing out a weak team gets an unfair bonus and a huge underdog upset gets over-amplified.

## Why it's disproportionately risky for its size

The rating formula lives in exactly one authoritative place today (`record_match`), but it's mirrored client-side in `EloService.project()` for two previews (Record Match's pre-submit confirmation and Live Mode's finish prompt). A margin formula would need to be implemented identically in both SQL and TypeScript and kept in lockstep -- the same class of risk that caused two of the three production bugs fixed earlier this session (duplicated logic silently drifting apart), except the margin math is meaningfully more complex than the threshold tables that drifted before.

Matches also don't have a fixed, enforced target score -- Live Mode lets a player pick "first to N" per match, and Record Match doesn't enforce any target at all -- so an absolute point difference (10-0 vs 3-0) isn't comparable across matches. Margin would need to be expressed as a ratio or normalized against the winning score, and tuning that normalization plus the damping term is a genuine design decision, not just implementation; it would likely need empirical tuning against this group's real match history to feel fair rather than arbitrary.

Score is also currently optional on Record Match (an after-the-fact entry may not remember the exact score). If score drives Elo, either it becomes required everywhere (a real friction change for after-the-fact entry) or a fallback is needed for when it's missing -- which reintroduces the exact inconsistency the current design avoids, since two players could get different treatment for the same win depending on whether a score was typed in. Live Mode always has a score by construction, so it's naturally compatible; Record Match is the one that would need to change.

Placement matches (section 13) use this exact same formula, so margin-adjusted Elo would also apply during the 10 matches that determine a new player's entire starting rank -- worth an explicit decision on whether that's wanted, since it amplifies variance right when it matters most for a first impression of rank. The Demotion Shield's win/lose resolution (section 19) stays binary either way and would not need to change.

No backfill of historical matches would be needed -- Elo is running state, not recomputed from history, so a change would be forward-only, the same way the section-49 season-compression feature is.

## Pros

Rewards genuine dominance over a narrow squeak-through, matching how players already talk about their matches informally. It's a well-precedented technique (not novel), so there's a known-good formula shape to start from. It also partially corrects for the fact that a short, fast game decided by one point carries real luck -- weighting decisive wins more improves the signal quality of the rating.

## Cons

It reverses a deliberate design decision (section 9) rather than extending one, and it changes what an Elo delta *means* -- two wins could produce very different point swings, a strictly more complex mental model for players. The sharper concern for a friendly office ladder specifically: score becomes a ranking lever, creating a real incentive to keep playing out a match that's already decided just to pad the margin, instead of ending it once it's obviously over -- arguably a worse social dynamic than what exists today, and very likely the actual reason score was excluded from the rating math in the first place. Beyond that: the two-implementation drift risk, the required-score friction for Record Match, and the open (not just mechanical) normalization question above.

## If this is ever revisited

Recommended scope: a capped multiplier (e.g. bounded to roughly 0.85x-1.3x of the base delta, not unbounded) so it nudges results rather than dominates them, explicitly exempted from placement matches, with the formula and its test fixtures written and verified before `record_match` itself is touched.

---

# 57. Addendum — "How Ranking Works" Page

Adds a new, static explainer page (route `/how-it-works`) aimed at someone with zero prior familiarity with Elo/RR/tier-based ranking systems. It exists because the app surfaces a lot of specialized vocabulary -- Elo, RR, tiers, divisions, placement matches, the Demotion Shield -- with no in-app explanation of what any of it means or how it's calculated.

## Content

The page walks through, in plain language, with worked examples: what Elo is and how the team-average / expected-probability / K-factor delta formula works (section 5-8); placement matches and the Unranked -> reveal flow (section 13); the full tier and division table with Elo ranges (sections 10-11); what RR is and its formula (section 12); automatic rank-ups (section 14); the Demotion Shield mechanic end to end (sections 18-20); Lixo and Champion as the two edge tiers (sections 14-15, 20); and a glossary covering the remaining terms shown elsewhere in the app (Peak Elo, K-factor, expected win probability, demotion pending, win streak, Best/Worst Teammate). It also states plainly, in the Elo section, that the actual football score currently has no effect on Elo (see section 9 and section 56 above) -- a fact a newcomer would otherwise have no way to know.

## Implementation note

Every worked number on the page (the Elo example's team averages and deltas, the RR examples, the placement-reveal examples, and the entire tier/Elo-range table) is computed live through the real `RankService`/`EloService`/`rank.constants.ts` rather than hand-typed, specifically so the explainer can never drift out of sync with what `record_match` actually does -- the same discipline the spec document itself is held to, and the direct lesson from this session's three duplicated-logic production bugs.

## Discoverability

A "How ranking works" icon link sits in the main toolbar (always visible, all screen sizes), and a "How ranks are calculated" link sits on the Leaderboard page's heading, since that's the page most likely to prompt the question.
