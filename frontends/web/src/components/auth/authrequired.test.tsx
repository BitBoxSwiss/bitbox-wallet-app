// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { useContext } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, subscribeAuth, TAuthEventObject } from '@/api/backend';
import { AppContext } from '@/contexts/AppContext';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { useBackButton } from '@/hooks/backbutton';
import { useKeydown } from '@/hooks/keyboard';
import { AuthRequired } from './authrequired';

vi.mock('@/i18n/i18n');
vi.mock('@/api/backend', () => ({
  authenticate: vi.fn().mockResolvedValue(undefined),
  subscribeAuth: vi.fn(),
}));
vi.mock('@/api/version', () => ({ getVersion: vi.fn().mockResolvedValue('test') }));
vi.mock('@/utils/env', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/env')>(),
  runningOnMobile: () => true,
}));

let onAuth: (event: TAuthEventObject) => void;
const send = vi.fn();
const closeRequest = vi.fn(() => false);
const shortcut = vi.fn();
const controlKey = vi.fn();
const toggleGuide = vi.fn();

const Request = () => {
  useBackButton(closeRequest);
  useKeydown(shortcut);
  return (
    <button onClick={send} onKeyDown={controlKey} onKeyUp={controlKey} onKeyPress={controlKey}>
      Send
    </button>
  );
};

type TProps = { showRequest?: boolean; guideShown?: boolean; showLock?: boolean };

const TestApp = ({ showRequest = true, guideShown = false, showLock = true }: TProps) => {
  const app = useContext(AppContext);
  return (
    <AppContext.Provider value={{ ...app, guideShown, toggleGuide }}>
      <BackButtonProvider>
        {showLock && <AuthRequired />}
        {showRequest && <Request />}
      </BackButtonProvider>
    </AppContext.Provider>
  );
};

const deliver = (event: TAuthEventObject) => act(() => onAuth(event));
const unlock = () => deliver({ typ: 'auth-result', result: 'authres-ok' });
const back = () => act(() => {
  expect(window.onBackButtonPressed?.()).toBe(false);
});

describe('AuthRequired input blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeAuth).mockImplementation(callback => {
      onAuth = callback;
      return () => {};
    });
  });

  // A background control can retain focus; neither browser defaults nor app shortcuts may act on it.
  it('blocks focus navigation, activation and keyboard handlers behind the lock', async () => {
    const user = userEvent.setup();
    render(<TestApp />);
    deliver({ typ: 'auth-result', result: 'authres-cancel' });
    const button = screen.getByRole('button', { name: 'Send' });
    button.focus();

    await user.keyboard('[Tab][Enter][Space][Escape]');
    expect(fireEvent.keyPress(button, { key: 'x', charCode: 120 })).toBe(false);

    expect(button).toHaveFocus();
    expect(send).not.toHaveBeenCalled();
    expect(shortcut).not.toHaveBeenCalled();
    expect(controlKey).not.toHaveBeenCalled();
  });

  // Unlocking restores normal keyboard input and Back; a later lock must reinstall both guards.
  it('restores input after authentication and blocks it again on relock', async () => {
    const user = userEvent.setup();
    render(<TestApp />);
    unlock();
    const button = screen.getByRole('button', { name: 'Send' });
    button.focus();
    await user.keyboard('[Enter]');
    back();
    expect(send).toHaveBeenCalledTimes(1);
    expect(shortcut).toHaveBeenCalledTimes(1);
    expect(controlKey).toHaveBeenCalled();
    expect(closeRequest).toHaveBeenCalledTimes(1);

    deliver({ typ: 'auth-required' });
    await user.keyboard('[Enter]');
    back();
    expect(send).toHaveBeenCalledTimes(1);
    expect(shortcut).toHaveBeenCalledTimes(1);
    expect(closeRequest).toHaveBeenCalledTimes(1);

    unlock();
    await user.keyboard('[Space]');
    back();
    expect(send).toHaveBeenCalledTimes(2);
    expect(closeRequest).toHaveBeenCalledTimes(2);
  });

  // A Space press begun before locking must not activate a background button when released afterward.
  it('blocks key releases from presses that began before locking', async () => {
    const user = userEvent.setup();
    render(<TestApp />);
    unlock();
    screen.getByRole('button', { name: 'Send' }).focus();
    await user.keyboard('[Space>]');
    controlKey.mockClear();

    deliver({ typ: 'auth-required' });
    await user.keyboard('[/Space]');

    expect(send).not.toHaveBeenCalled();
    expect(controlKey).not.toHaveBeenCalled();
  });

  // New views must not supersede the lock's Back protection, including when the mobile guide is open.
  it.each([false, true])('blocks late Back handlers with guideShown=%s', guideShown => {
    const { rerender } = render(<TestApp showRequest={false} guideShown={guideShown} />);
    rerender(<TestApp guideShown={guideShown} />);

    back();
    expect(closeRequest).not.toHaveBeenCalled();
    expect(toggleGuide).not.toHaveBeenCalled();

    unlock();
    back();
    expect(closeRequest).toHaveBeenCalledTimes(guideShown ? 0 : 1);
    expect(toggleGuide).toHaveBeenCalledTimes(guideShown ? 1 : 0);
  });

  // Unsuccessful native authentication keeps the lock active while allowing a tap to retry.
  it.each(['authres-cancel', 'authres-err', 'authres-missing'] as const)(
    'keeps input blocked after %s and allows tapping Authenticate', async result => {
      const user = userEvent.setup();
      render(<TestApp showRequest={false} />);
      deliver({ typ: 'auth-result', result });
      const button = screen.getByRole('button', { name: 'auth.authButton' });

      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(false);
      back();
      await user.click(button);
      expect(authenticate).toHaveBeenCalledTimes(2);
      expect(authenticate).toHaveBeenLastCalledWith(false);

      unlock();
      expect(window.onBackButtonPressed?.()).toBe(true);
    }
  );

  // Cancelling the prompt to enable app lock must leave the previously unlocked app usable.
  it('restores input when forced authentication is cancelled', async () => {
    const user = userEvent.setup();
    render(<TestApp />);
    unlock();
    deliver({ typ: 'auth-forced' });
    deliver({ typ: 'auth-required' });
    expect(authenticate).toHaveBeenLastCalledWith(true);
    deliver({ typ: 'auth-result', result: 'authres-cancel' });

    screen.getByRole('button', { name: 'Send' }).focus();
    await user.keyboard('[Enter]');
    back();
    expect(send).toHaveBeenCalledTimes(1);
    expect(closeRequest).toHaveBeenCalledTimes(1);
  });

  // Unmounting the lock must remove its global listeners so input is not left disabled.
  it('cleans up input blocking when the lock component unmounts', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TestApp />);
    rerender(<TestApp showLock={false} />);

    screen.getByRole('button', { name: 'Send' }).focus();
    await user.keyboard('[Enter]');
    back();
    expect(send).toHaveBeenCalledTimes(1);
    expect(shortcut).toHaveBeenCalledTimes(1);
    expect(closeRequest).toHaveBeenCalledTimes(1);
  });
});
