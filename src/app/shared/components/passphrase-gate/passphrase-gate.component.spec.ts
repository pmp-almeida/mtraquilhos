import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { PassphraseGateComponent } from './passphrase-gate.component';
import { AccessGateService } from '../../../core/services/access-gate.service';

describe('PassphraseGateComponent', () => {
  let fixture: ComponentFixture<PassphraseGateComponent>;
  let component: PassphraseGateComponent;
  let tryUnlock: ReturnType<typeof vi.fn>;

  async function setup(): Promise<void> {
    tryUnlock = vi.fn();

    await TestBed.configureTestingModule({
      imports: [PassphraseGateComponent],
      providers: [
        { provide: AccessGateService, useValue: { tryUnlock, unlocked: signal(false), required: true } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PassphraseGateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('renders the gate card with the brand title and passphrase field', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-card-title')?.textContent).toContain('MTraquilhos');
    expect(el.querySelector('input[name="passphrase"]')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('does not call tryUnlock when the passphrase is empty', async () => {
    component.passphrase = '';
    await component.submit();
    expect(tryUnlock).not.toHaveBeenCalled();
  });

  it('does not call tryUnlock when the passphrase is only whitespace', async () => {
    component.passphrase = '   ';
    await component.submit();
    expect(tryUnlock).not.toHaveBeenCalled();
  });

  it('disables the submit button while the passphrase field is empty', () => {
    component.passphrase = '';
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the submit button once a non-whitespace passphrase is entered', () => {
    component.passphrase = 'secret';
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('unlocks with no error shown when the passphrase is correct', async () => {
    tryUnlock.mockResolvedValue(true);
    component.passphrase = 'correct-pass';

    await component.submit();
    fixture.detectChanges();

    expect(tryUnlock).toHaveBeenCalledWith('correct-pass');
    expect(component.error()).toBe('');
    expect(fixture.nativeElement.querySelector('.error')).toBeNull();
  });

  it('shows the incorrect-passphrase error when tryUnlock resolves false', async () => {
    tryUnlock.mockResolvedValue(false);
    component.passphrase = 'wrong-pass';

    await component.submit();
    fixture.detectChanges();

    expect(component.error()).toBe('That passphrase is not correct.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('That passphrase is not correct.');
  });

  it('clears the passphrase field after a successful submit', async () => {
    tryUnlock.mockResolvedValue(true);
    component.passphrase = 'correct-pass';
    await component.submit();
    expect(component.passphrase).toBe('');
  });

  it('clears the passphrase field even after a failed submit', async () => {
    tryUnlock.mockResolvedValue(false);
    component.passphrase = 'wrong-pass';
    await component.submit();
    expect(component.passphrase).toBe('');
  });

  it('sets checking() to true while the unlock call is pending and back to false once resolved', async () => {
    let resolveUnlock: (value: boolean) => void;
    tryUnlock.mockImplementation(() => new Promise<boolean>(resolve => { resolveUnlock = resolve; }));
    component.passphrase = 'secret';

    const submitPromise = component.submit();
    expect(component.checking()).toBe(true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Checking');

    resolveUnlock!(true);
    await submitPromise;

    expect(component.checking()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').textContent).toContain('Enter');
  });

  it('is a no-op re-submit while already checking', async () => {
    let resolveUnlock: (value: boolean) => void;
    tryUnlock.mockImplementation(() => new Promise<boolean>(resolve => { resolveUnlock = resolve; }));
    component.passphrase = 'secret';

    const firstSubmit = component.submit();
    expect(component.checking()).toBe(true);

    // A second submit call while checking() is true must not call tryUnlock again.
    await component.submit();
    expect(tryUnlock).toHaveBeenCalledTimes(1);

    resolveUnlock!(true);
    await firstSubmit;
  });

  it('submits via the form ngSubmit event and reaches the AccessGateService', async () => {
    tryUnlock.mockResolvedValue(true);
    const input = fixture.nativeElement.querySelector('input[name="passphrase"]') as HTMLInputElement;
    input.value = 'from-the-dom';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tryUnlock).toHaveBeenCalledWith('from-the-dom');
  });
});
