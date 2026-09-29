import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { I18nService } from '../../../core/i18n/i18n.service';
import { Locale } from '../../../core/i18n/locale';

describe('LanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let component: LanguageSwitcherComponent;
  let setLocale: ReturnType<typeof vi.fn>;
  let localeSignal: ReturnType<typeof signal<Locale>>;

  async function setup(initial: Locale): Promise<void> {
    localeSignal = signal<Locale>(initial);
    setLocale = vi.fn((l: Locale) => localeSignal.set(l));

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [{
        provide: I18nService,
        useValue: {
          locale: localeSignal,
          setLocale,
          t: (key: string) => (key === 'lang.label' ? 'Language' : key)
        }
      }]
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('shortCode()', () => {
    it('returns PT for pt-PT', async () => {
      await setup('en-GB');
      expect(component.shortCode('pt-PT')).toBe('PT');
    });

    it('returns EN for en-GB (the non-pt-PT branch)', async () => {
      await setup('en-GB');
      expect(component.shortCode('en-GB')).toBe('EN');
    });
  });

  it('renders the trigger button with the short code for the current locale', async () => {
    await setup('pt-PT');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.lang-trigger')?.getAttribute('aria-label')).toBe('Language');
    expect(el.querySelector('.lang-code')?.textContent).toBe('PT');
  });

  it('updates the trigger short code when the locale changes to en-GB', async () => {
    await setup('pt-PT');
    localeSignal.set('en-GB');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.lang-code')?.textContent).toBe('EN');
  });

  it('opens the menu and renders one item per supported locale with correct checked icon', async () => {
    await setup('en-GB');
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button.lang-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')) as HTMLElement[];
    expect(items.length).toBe(2);

    const enItem = items.find(i => i.textContent?.includes('English'));
    const ptItem = items.find(i => i.textContent?.includes('Português'));
    expect(enItem?.querySelector('mat-icon')?.textContent).toBe('radio_button_checked');
    expect(enItem?.classList.contains('active')).toBe(true);
    expect(ptItem?.querySelector('mat-icon')?.textContent).toBe('radio_button_unchecked');
    expect(ptItem?.classList.contains('active')).toBe(false);
  });

  it('calls i18n.setLocale() with the clicked locale via a real menu-item click', async () => {
    await setup('en-GB');
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button.lang-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')) as HTMLElement[];
    const ptItem = items.find(i => i.textContent?.includes('Português'));
    ptItem?.click();
    fixture.detectChanges();

    expect(setLocale).toHaveBeenCalledWith('pt-PT');
  });

  it('calls i18n.setLocale() with en-GB when that menu item is clicked', async () => {
    await setup('pt-PT');
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button.lang-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')) as HTMLElement[];
    const enItem = items.find(i => i.textContent?.includes('English'));
    enItem?.click();
    fixture.detectChanges();

    expect(setLocale).toHaveBeenCalledWith('en-GB');
  });
});
