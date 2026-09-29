import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService, Theme } from '../../../core/services/theme.service';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let toggle: ReturnType<typeof vi.fn>;
  let themeSignal: ReturnType<typeof signal<Theme>>;

  async function setup(initial: Theme): Promise<void> {
    themeSignal = signal<Theme>(initial);
    toggle = vi.fn(() => themeSignal.set(themeSignal() === 'dark' ? 'light' : 'dark'));

    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [{ provide: ThemeService, useValue: { theme: themeSignal, toggle } }]
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
  }

  it('shows the dark_mode icon and "switch to dark" tooltip/label when the theme is light', async () => {
    await setup('light');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-icon')?.textContent).toBe('dark_mode');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('shows the light_mode icon and "switch to light" tooltip/label when the theme is dark', async () => {
    await setup('dark');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-icon')?.textContent).toBe('light_mode');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('calls theme.toggle() and flips the icon on a real click', async () => {
    await setup('dark');
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(themeSignal()).toBe('light');
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-icon')?.textContent).toBe('dark_mode');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('toggles back on a second click', async () => {
    await setup('light');
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();

    expect(toggle).toHaveBeenCalledTimes(2);
    expect(themeSignal()).toBe('light');
  });
});
