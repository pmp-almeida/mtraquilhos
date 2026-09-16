import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatchService } from '../../core/services/match.service';

@Component({
  selector: 'app-record-match',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatRadioModule, MatSnackBarModule],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Record a 2v2 match</mat-card-title><mat-card-subtitle>Players and the winner are required; scores are optional.</mat-card-subtitle></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="grid">
            @for (field of playerFields; track field) {
              <mat-form-field appearance="outline"><mat-label>{{ field }}</mat-label><input matInput [formControlName]="field" /></mat-form-field>
            }
            <mat-form-field appearance="outline"><mat-label>Score A</mat-label><input matInput type="number" formControlName="scoreA" min="0" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Score B</mat-label><input matInput type="number" formControlName="scoreB" min="0" /></mat-form-field>
          </div>
          <mat-radio-group formControlName="winner"><mat-radio-button value="A">Team A wins</mat-radio-button><mat-radio-button value="B">Team B wins</mat-radio-button></mat-radio-group>
          <div class="actions"><button mat-button type="button" (click)="form.reset({ winner: 'A' })">Clear</button><button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving">Preview and record</button></div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; } mat-radio-button { margin: 12px 16px 12px 0; } .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; } @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }`]
})
export class RecordMatchComponent {
  private readonly fb = inject(FormBuilder);
  private readonly matchService = inject(MatchService);
  private readonly snackBar = inject(MatSnackBar);
  readonly playerFields = ['teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2'];
  readonly form = this.fb.nonNullable.group({ teamAPlayer1: ['', Validators.required], teamAPlayer2: ['', Validators.required], teamBPlayer1: ['', Validators.required], teamBPlayer2: ['', Validators.required], winner: ['A' as 'A' | 'B', Validators.required], scoreA: [null as number | null], scoreB: [null as number | null] });
  saving = false;

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const playerIds = [value.teamAPlayer1, value.teamAPlayer2, value.teamBPlayer1, value.teamBPlayer2];
    if (new Set(playerIds).size !== 4) { this.snackBar.open('Select four distinct players.', 'Close', { duration: 3000 }); return; }
    this.saving = true;
    try {
      await this.matchService.record({ teamAPlayer1: value.teamAPlayer1, teamAPlayer2: value.teamAPlayer2, teamBPlayer1: value.teamBPlayer1, teamBPlayer2: value.teamBPlayer2, winner: value.winner, scoreA: value.scoreA ?? undefined, scoreB: value.scoreB ?? undefined });
      this.snackBar.open('Match recorded.', 'Close', { duration: 3000 }); this.form.reset({ winner: 'A' });
    }
    catch (error) { this.snackBar.open(error instanceof Error ? error.message : 'Could not record match.', 'Close', { duration: 4000 }); }
    finally { this.saving = false; }
  }
}