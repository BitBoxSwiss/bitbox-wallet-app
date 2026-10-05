// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { ReactNode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAuthEventObject } from '@/api/backend';
import { AuthRequired } from '@/components/auth/authrequired';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { WhatsNew } from './whats-new';

const apiMocks = vi.hoisted(() => ({
  getWhatsNew: vi.fn(), dismissWhatsNew: vi.fn(), getWhatsNewImage: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  authenticate: vi.fn(), subscribeAuth: vi.fn(),
}));

vi.mock('@/api/whats-new', () => apiMocks);
vi.mock('@/api/backend', () => authMocks);
vi.mock('@/utils/env', () => ({
  runningInAndroid: () => false,
  runningInIOS: () => true,
  runningOnMobile: () => true,
}));
vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: () => false,
}));
vi.mock('@/components/view/view', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewContent: () => null,
  ViewHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const AuthenticatedNotes = () => {
  const [authReady, setAuthReady] = useState(false);
  return (
    <BackButtonProvider>
      <AuthRequired onReadyChange={setAuthReady} />
      <WhatsNew active={authReady} />
    </BackButtonProvider>
  );
};

describe('release notes during authentication', () => {
  let notifyAuth: (event: TAuthEventObject) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    authMocks.authenticate.mockResolvedValue(undefined);
    authMocks.subscribeAuth.mockImplementation((callback: typeof notifyAuth) => {
      notifyAuth = callback;
      return () => {};
    });
    apiMocks.getWhatsNew.mockResolvedValue({
      version: '4.53.0',
      highlights: ['First', 'Second', 'Last'].map(title => ({
        group: 'common', content: { en: { title, description: 'Release details.' } },
      })),
    });
    apiMocks.dismissWhatsNew.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Opening the notes after authentication moves focus inside and keeps Tab navigation contained.
  it('focuses and contains keyboard navigation in the notes', async () => {
    vi.useRealTimers();
    // JSDOM does not calculate layout, so visible controls need an offset parent.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    const user = userEvent.setup();
    render(<><button>Background</button><AuthenticatedNotes /></>);
    screen.getByRole('button', { name: 'Background' }).focus();
    await act(async () => notifyAuth({ typ: 'auth-result', result: 'authres-ok' }));

    const close = screen.getByTestId('close-button');
    const last = screen.getByRole('button', { name: 'button.next' });
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'button.next' })).toHaveFocus();
  });

  it('preserves the page and dismissal across authentication', async () => {
    render(<AuthenticatedNotes />);
    expect(apiMocks.getWhatsNew).not.toHaveBeenCalled();

    await act(async () => notifyAuth({ typ: 'auth-result', result: 'authres-ok' }));
    act(() => vi.advanceTimersByTime(20));
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));

    act(() => notifyAuth({ typ: 'auth-required' }));
    expect(screen.getByText('Second')).not.toBeVisible();
    expect(screen.queryByTestId('close-button')).not.toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => {
      window.onBackButtonPressed?.();
      vi.advanceTimersByTime(16000);
    });
    expect(apiMocks.dismissWhatsNew).not.toHaveBeenCalled();

    act(() => notifyAuth({ typ: 'auth-result', result: 'authres-ok' }));
    expect(screen.getByRole('heading', { name: 'Second' })).toBeVisible();
    expect(apiMocks.getWhatsNew).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
    expect(screen.getByRole('heading', { name: 'Last' })).toBeVisible();

    fireEvent.click(screen.getByTestId('close-button'));
    await act(async () => vi.advanceTimersByTime(400));
    expect(apiMocks.dismissWhatsNew).toHaveBeenCalledWith('4.53.0');
    act(() => notifyAuth({ typ: 'auth-required' }));
    act(() => notifyAuth({ typ: 'auth-result', result: 'authres-ok' }));
    expect(screen.queryByRole('heading', { name: 'Last' })).not.toBeInTheDocument();
  });
});
