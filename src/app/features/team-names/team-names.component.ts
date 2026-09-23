import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Player } from '../../core/models/player';
import { PlayerService } from '../../core/services/player.service';
import { TeamName, teamPairKey } from '../../core/models/team-name';
import { TeamNameService } from '../../core/services/team-name.service';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Lets a pair of players be given a fun, persistent team name -- purely
 * cosmetic. team_names is a standalone lookup table only ever consulted for
 * display strings; it has no effect on Elo, RR, rank, or record_match.
 * Whenever the exact same unordered pair ends up on a team elsewhere in the
 * app (match history, dashboard, live match, generate teams, record match,
 * a player's own match list), that display falls back to this name instead
 * of "Player A & Player B".
 */
@Component({
  selector: 'app-team-names',
  standalone: true,
  imports: [
    FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule
  ],
  template: `
    <section class="heading">
      <p class="tf-eyebrow">{{ i18n.t('teamNames.eyebrow') }}</p>
      <h1>{{ i18n.t('teamNames.title') }}</h1>
      <p>{{ i18n.t('teamNames.subtitle') }}</p>
    </section>

    @if (error) { <p class="tf-error" role="alert">{{ error }}</p> }

    <mat-card>
      <mat-card-header><mat-card-title>{{ i18n.t('teamNames.formTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        @if (existingPairName(); as existing) {
          <p class="hint">{{ i18n.t('teamNames.editing', { pair: pairLabel(existing.playerLow, existing.playerHigh) }) }}</p>
        }
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ i18n.t('teamNames.player1Label') }}</mat-label>
            <mat-select [ngModel]="playerAId" (ngModelChange)="playerAId = $event; onPairChanged()">
              <mat-option value="">{{ i18n.t('teamNames.selectPlayer') }}</mat-option>
              @for (p of players(); track p.id) { <mat-option [value]="p.id">{{ p.displayName }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ i18n.t('teamNames.player2Label') }}</mat-label>
            <mat-select [ngModel]="playerBId" (ngModelChange)="playerBId = $event; onPairChanged()">
              <mat-option value="">{{ i18n.t('teamNames.selectPlayer') }}</mat-option>
              @for (p of players(); track p.id) { <mat-option [value]="p.id">{{ p.displayName }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ i18n.t('teamNames.nameLabel') }}</mat-label>
            <input matInput [(ngModel)]="nameInput" maxlength="40" />
          </mat-form-field>
        </div>
        <div class="actions">
          <button mat-button type="button" (click)="clearForm()">{{ i18n.t('teamNames.clearForm') }}</button>
          <button mat-flat-button color="primary" [disabled]="saving() || !canSave()" (click)="save()">
            <mat-icon aria-hidden="true">sell</mat-icon>
            {{ i18n.t('teamNames.save') }}
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card class="list-card">
      <mat-card-header><mat-card-title>{{ i18n.t('teamNames.listTitle') }}</mat-card-title></mat-card-header>
      <mat-card-content>
        @if (!teamNames().length) { <p class="tf-empty">{{ i18n.t('teamNames.empty') }}</p> }
        @for (tn of teamNames(); track tn.id) {
          <div class="row">
            <div class="info">
              <span class="name">{{ tn.name }}</span>
              <span class="pair">{{ pairLabel(tn.playerLow, tn.playerHigh) }}</span>
            </div>
            <div class="row-actions">
              @if (deletingId() === tn.id) {
                <span class="confirm-prompt">{{ i18n.t('teamNames.deletePrompt') }}</span>
                <button mat-button (click)="deletingId.set(null)">{{ i18n.t('common.cancel') }}</button>
                <button mat-button color="warn" (click)="remove(tn)">{{ i18n.t('teamNames.deleteConfirm') }}</button>
              } @else {
                <button mat-icon-button [attr.aria-label]="i18n.t('teamNames.editAria', { pair: pairLabel(tn.playerLow, tn.playerHigh) })" (click)="edit(tn)">
                  <mat-icon aria-hidden="true">edit</mat-icon>
                </button>
                <button mat-icon-button [attr.aria-label]="i18n.t('teamNames.deleteAria', { pair: pairLabel(tn.playerLow, tn.playerHigh) })" (click)="deletingId.set(tn.id)">
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              }
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .heading { margin-bottom: 16px; max-width: 640px; }
    h1 { margin: 8px 0; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 4px; }
    .hint { margin: 0 0 4px; color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .actions mat-icon { margin-right: 6px; }
    .list-card { margin-top: 16px; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); flex-wrap: wrap; }
    .info { display: flex; flex-direction: column; gap: 2px; }
    .name { font-weight: 600; }
    .pair { font-size: 0.82rem; color: var(--mat-sys-on-surface-variant); }
    .row-actions { display: flex; align-items: center; gap: 2px; }
    .confirm-prompt { font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .actions { justify-content: stretch; } .actions button { width: 100%; } }
  `]
})
export class TeamNamesComponent {
  private readonly playerService = inject(PlayerService);
  private readonly teamNameService = inject(TeamNameService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  readonly players = signal<Player[]>([]);
  readonly teamNames = signal<TeamName[]>([]);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);
  private names: Record<string, string> = {};

  playerAId = '';
  playerBId = '';
  nameInput = '';
  error = '';

  async ngOnInit(): Promise<void> {
    try {
      const [players, teamNames, names] = await Promise.all([
        this.playerService.listAll(),
        this.teamNameService.listAll(),
        this.playerService.nameMap()
      ]);
      this.players.set(players);
      this.teamNames.set(teamNames);
      this.names = names;
      this.prefillFromState();
    } catch {
      this.error = this.i18n.t('teamNames.loadError');
    }
  }

  /**
   * The "name this duo" link on Generate Teams' Best Teams list hands off
   * its pair via router `state` (see RandomTeamsComponent.nameThisDuoState)
   * so the player doesn't have to re-pick both players here -- mirrors
   * LiveMatchComponent.prefillFromState's shape and validation.
   */
  private prefillFromState(): void {
    const state = history.state as Partial<Record<'playerAId' | 'playerBId', string>> | null;
    if (!state?.playerAId || !state?.playerBId || state.playerAId === state.playerBId) return;
    const known = new Set(this.players().map(p => p.id));
    if (!known.has(state.playerAId) || !known.has(state.playerBId)) return;
    this.playerAId = state.playerAId;
    this.playerBId = state.playerBId;
    this.onPairChanged();
  }

  /** The already-named team for whatever pair is currently selected in the form, if any -- drives the "you're editing X" hint. Recomputed on every render, same as e.g. MatchHistoryComponent.teamNames(); cheap and always current. */
  existingPairName(): TeamName | null {
    if (!this.playerAId || !this.playerBId || this.playerAId === this.playerBId) return null;
    const key = teamPairKey(this.playerAId, this.playerBId);
    return this.teamNames().find(tn => teamPairKey(tn.playerLow, tn.playerHigh) === key) ?? null;
  }

  /** Prefills the name field when the newly-selected pair already has a name, so picking an existing duo naturally becomes a rename rather than clobbering it with an empty save. */
  onPairChanged(): void {
    const existing = this.existingPairName();
    if (existing && !this.nameInput.trim()) this.nameInput = existing.name;
  }

  canSave(): boolean {
    return !!this.playerAId && !!this.playerBId && this.playerAId !== this.playerBId && this.nameInput.trim().length > 0;
  }

  pairLabel(idLow: string, idHigh: string): string {
    return `${this.nameOf(idLow)} & ${this.nameOf(idHigh)}`;
  }

  nameOf(id: string): string {
    return this.names[id] ?? this.i18n.t('common.unknownPlayer');
  }

  clearForm(): void {
    this.playerAId = '';
    this.playerBId = '';
    this.nameInput = '';
  }

  edit(tn: TeamName): void {
    this.playerAId = tn.playerLow;
    this.playerBId = tn.playerHigh;
    this.nameInput = tn.name;
    this.deletingId.set(null);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    if (!this.canSave()) {
      this.snackBar.open(this.i18n.t('teamNames.selectTwoDistinct'), this.i18n.t('common.close'), { duration: 3000 });
      return;
    }
    this.saving.set(true);
    try {
      const saved = await this.teamNameService.setName(this.playerAId, this.playerBId, this.nameInput);
      this.teamNames.update(list => {
        const key = teamPairKey(saved.playerLow, saved.playerHigh);
        const rest = list.filter(tn => teamPairKey(tn.playerLow, tn.playerHigh) !== key);
        return [...rest, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      this.snackBar.open(this.i18n.t('teamNames.saveSuccess', { name: saved.name }), this.i18n.t('common.close'), { duration: 4000 });
      this.clearForm();
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('teamNames.saveError'), this.i18n.t('common.close'), { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  async remove(tn: TeamName): Promise<void> {
    try {
      await this.teamNameService.clear(tn.playerLow, tn.playerHigh);
      this.teamNames.update(list => list.filter(x => x.id !== tn.id));
      this.deletingId.set(null);
      this.snackBar.open(this.i18n.t('teamNames.deleteSuccess'), this.i18n.t('common.close'), { duration: 3000 });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : this.i18n.t('teamNames.deleteError'), this.i18n.t('common.close'), { duration: 5000 });
    }
  }
}
