// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/keystores', () => ({
  connectAnyKeystore: vi.fn(),
  connectKeystore: vi.fn(),
}));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: () => <div>firmware upgrade required</div>,
}));
vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: () => false,
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { CoinCode, TAccount } from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { ActionButtons } from './actionButtons';

const account: TAccount = {
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  keystore: {
    connected: false,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  name: 'Bitcoin Account',
};

const Location = () => {
  const location = useLocation();
  return <div>{location.pathname}</div>;
};

const renderActionButtons = (coinCode: CoinCode = 'btc') => {
  const currentAccount = { ...account, coinCode };
  render(
    <MemoryRouter initialEntries={['/account/btc-account']}>
      <ActionButtons
        account={currentAccount}
        accountDataLoaded
        canSend
        code={currentAccount.code}
        coinCode={coinCode}
      />
      <Location />
    </MemoryRouter>
  );
};

describe('routes/account/actionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prompts for an upgrade before entering the send screen', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'firmwareUpgradeRequired',
    });
    renderActionButtons();

    fireEvent.click(screen.getByRole('link', { name: 'generic.send' }));

    await waitFor(() => {
      expect(connectKeystore).toHaveBeenCalledWith(
        account.keystore.rootFingerprint,
        'btcTransactionSigning',
      );
    });
    expect(await screen.findByText('firmware upgrade required')).toBeInTheDocument();
    expect(screen.getByText('/account/btc-account')).toBeInTheDocument();
  });

  it.each([
    ['btc', 'btcTransactionSigning'],
    ['eth', 'ethTransactionSigning'],
  ] as const)('checks %s signing support before navigating', async (coinCode, requiredFeature) => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    renderActionButtons(coinCode);

    fireEvent.click(screen.getByRole('link', { name: 'generic.send' }));

    await waitFor(() => {
      expect(connectKeystore).toHaveBeenCalledWith(
        account.keystore.rootFingerprint,
        requiredFeature,
      );
    });
    expect(screen.getByText('/account/btc-account/send')).toBeInTheDocument();
  });

  it('keeps action links mounted while account data loads', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/account/btc-account']}>
        <ActionButtons
          account={account}
          accountDataLoaded={false}
          canSend
          code={account.code}
          coinCode={account.coinCode}
        />
        <Location />
      </MemoryRouter>
    );

    const send = screen.getByRole('link', { name: 'generic.send' });
    const receive = screen.getByRole('link', { name: 'generic.receiveWithoutCoinCode' });
    const marketplace = screen.getByRole('link', { name: 'generic.buySell' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(receive).toHaveAttribute('aria-disabled', 'true');
    expect(marketplace).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(send);
    expect(screen.getByText('/account/btc-account')).toBeInTheDocument();
    expect(connectKeystore).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter initialEntries={['/account/btc-account']}>
        <ActionButtons
          account={account}
          accountDataLoaded
          canSend
          code={account.code}
          coinCode={account.coinCode}
          exchangeSupported
        />
        <Location />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'generic.send' })).toBe(send);
    expect(screen.getByRole('link', { name: 'generic.receiveWithoutCoinCode' })).toBe(receive);
    expect(screen.getByRole('link', { name: 'generic.buySell' })).toBe(marketplace);
  });
});
