import { vi } from 'vitest';
import { InstallPromptService } from './install-prompt.service';

function beforeInstallPromptEvent(userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>) {
  const evt: any = new Event('beforeinstallprompt');
  evt.prompt = vi.fn().mockResolvedValue(undefined);
  evt.userChoice = userChoice;
  return evt as Event & { prompt: ReturnType<typeof vi.fn>; userChoice: typeof userChoice };
}

describe('InstallPromptService', () => {
  it('starts with available() false', () => {
    const service = new InstallPromptService();
    expect(service.available()).toBe(false);
  });

  it('promptInstall() is a no-op with nothing captured yet', async () => {
    const service = new InstallPromptService();
    await expect(service.promptInstall()).resolves.toBeUndefined();
    expect(service.available()).toBe(false);
  });

  it('flips available() true when the browser fires beforeinstallprompt, and calls preventDefault on it', () => {
    const service = new InstallPromptService();
    const evt = beforeInstallPromptEvent(Promise.resolve({ outcome: 'accepted', platform: 'web' }));
    const preventDefault = vi.spyOn(evt, 'preventDefault');

    window.dispatchEvent(evt);

    expect(service.available()).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('promptInstall() calls the captured event\'s prompt() and awaits userChoice, then clears availability', async () => {
    const service = new InstallPromptService();
    const evt = beforeInstallPromptEvent(Promise.resolve({ outcome: 'accepted', platform: 'web' }));
    window.dispatchEvent(evt);
    expect(service.available()).toBe(true);

    await service.promptInstall();

    expect(evt.prompt).toHaveBeenCalledTimes(1);
    expect(service.available()).toBe(false);
  });

  it('promptInstall() only consumes the captured event once -- a second call is a no-op', async () => {
    const service = new InstallPromptService();
    const evt = beforeInstallPromptEvent(Promise.resolve({ outcome: 'dismissed', platform: 'web' }));
    window.dispatchEvent(evt);

    await service.promptInstall();
    await service.promptInstall();

    expect(evt.prompt).toHaveBeenCalledTimes(1);
  });

  it('appinstalled resets available() to false and clears the captured event', () => {
    const service = new InstallPromptService();
    const evt = beforeInstallPromptEvent(Promise.resolve({ outcome: 'accepted', platform: 'web' }));
    window.dispatchEvent(evt);
    expect(service.available()).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));

    expect(service.available()).toBe(false);
  });

  it('a captured event is discarded once appinstalled fires -- promptInstall() afterwards is a no-op', async () => {
    const service = new InstallPromptService();
    const evt = beforeInstallPromptEvent(Promise.resolve({ outcome: 'accepted', platform: 'web' }));
    window.dispatchEvent(evt);
    window.dispatchEvent(new Event('appinstalled'));

    await service.promptInstall();

    expect(evt.prompt).not.toHaveBeenCalled();
  });
});
