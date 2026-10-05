// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TAuthEventObject } from '@/api/backend';
import { AuthRequired } from './authrequired';

const authMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  subscribeAuth: vi.fn(),
}));

vi.mock('@/api/backend', () => authMocks);
vi.mock('@/hooks/backbutton', () => ({ UseDisableBackButton: () => null }));
vi.mock('@/components/view/view', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewButtons: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ViewContent: () => null,
  ViewHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe('AuthRequired readiness', () => {
  let notifyAuth: (event: TAuthEventObject) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.authenticate.mockResolvedValue(undefined);
    authMocks.subscribeAuth.mockImplementation((callback: typeof notifyAuth) => {
      notifyAuth = callback;
      return () => {};
    });
  });

  it('opens the app after authentication and closes it for a later auth request', async () => {
    const onReadyChange = vi.fn();
    render(<AuthRequired onReadyChange={onReadyChange} />);
    await waitFor(() => expect(authMocks.authenticate).toHaveBeenCalledWith(false));

    act(() => notifyAuth({ typ: 'auth-result', result: 'authres-ok' }));
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    act(() => notifyAuth({ typ: 'auth-required' }));
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });
});
