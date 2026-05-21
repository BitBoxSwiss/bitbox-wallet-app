// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('@/api/lightning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...actual,
    getTopUpInfo: vi.fn(),
  };
});
vi.mock('@/api/keystores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/keystores')>();
  return {
    ...actual,
    connectKeystore: vi.fn(),
  };
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import * as lightningApi from '@/api/lightning';
import * as keystoresApi from '@/api/keystores';
import { ActionButtons } from './action-buttons';

const Location = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderActionButtons = () => render(
  <MemoryRouter initialEntries={['/lightning']}>
    <Routes>
      <Route path="/lightning" element={(
        <>
          <ActionButtons canSend />
          <Location />
        </>
      )} />
      <Route path="/lightning/top-up" element={<Location />} />
    </Routes>
  </MemoryRouter>
);

describe('routes/lightning/components/action-buttons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({ success: true });
  });

  it('connects backend-provided top-up fingerprint before navigation', async () => {
    vi.mocked(lightningApi.getTopUpInfo).mockResolvedValue({
      success: true,
      sourceAccounts: [],
      accountToConnectRootFingerprint: 'f23ab988',
    });
    const user = userEvent.setup();

    renderActionButtons();
    await user.click(screen.getByRole('link', { name: /top/i }));

    await waitFor(() => {
      expect(lightningApi.getTopUpInfo).toHaveBeenCalledTimes(1);
      expect(keystoresApi.connectKeystore).toHaveBeenCalledWith('f23ab988');
      expect(screen.getByTestId('location')).toHaveTextContent('/lightning/top-up');
    });
  });

  it('navigates directly when backend has no connect target', async () => {
    vi.mocked(lightningApi.getTopUpInfo).mockResolvedValue({
      success: true,
      sourceAccounts: [],
    });
    const user = userEvent.setup();

    renderActionButtons();
    await user.click(screen.getByRole('link', { name: /top/i }));

    await waitFor(() => {
      expect(lightningApi.getTopUpInfo).toHaveBeenCalledTimes(1);
      expect(keystoresApi.connectKeystore).not.toHaveBeenCalled();
      expect(screen.getByTestId('location')).toHaveTextContent('/lightning/top-up');
    });
  });
});
