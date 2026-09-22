import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayersComponent } from './players.component';
import { PlayerService } from '../../core/services/player.service';

describe('PlayersComponent', () => {
  let fixture: ComponentFixture<PlayersComponent>;
  let playerService: { listActive: () => Promise<never[]>; create: () => Promise<never> };

  beforeEach(async () => {
    playerService = {
      listActive: () => Promise.resolve([]),
      create: () => Promise.reject(new Error('Player could not be created.'))
    };

    await TestBed.configureTestingModule({
      imports: [PlayersComponent],
      providers: [{ provide: PlayerService, useValue: playerService }]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayersComponent);
    await fixture.componentInstance.ngOnInit();
  });

  it('shows a creation error instead of failing silently', async () => {
    fixture.componentInstance.newName = 'Alice';

    await fixture.componentInstance.create();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Player could not be created.');
  });
});