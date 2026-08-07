// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/bitsurance', () => ({
  bitsuranceLookup: vi.fn(),
}));
vi.mock('@/api/keystores', () => ({
  connectAnyKeystore: vi.fn(),
  connectKeystore: vi.fn(),
}));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: () => <div>firmware upgrade required</div>,
}));
vi.mock('@/components/groupedaccountselector/groupedaccountselector', () => ({
  GroupedAccountSelector: () => null,
}));
vi.mock('@/components/layout', () => ({
  GuideWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
  GuidedContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  Header: () => null,
  Main: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/spinner/Spinner', () => ({
  Spinner: () => null,
}));
vi.mock('@/components/view/view', () => ({
  View: ({ children }: { children: ReactNode }) => <>{children}</>,
  ViewContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/routes/market/components/markettab', () => ({
  MarketTab: () => null,
}));
vi.mock('./guide', () => ({
  BitsuranceGuide: () => null,
}));

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import { bitsuranceLookup } from '@/api/bitsurance';
import { connectKeystore } from '@/api/keystores';
import { BitsuranceAccount } from './account';

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

describe('routes/bitsurance/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prompts for an upgrade before opening the widget', async () => {
    vi.mocked(bitsuranceLookup).mockResolvedValue({
      success: true,
      errorMessage: '',
      bitsuranceAccounts: [],
    });
    vi.mocked(connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'firmwareUpgradeRequired',
    });

    render(
      <MemoryRouter initialEntries={['/market/bitsurance/account/btc-account']}>
        <BitsuranceAccount accounts={[account]} code={account.code} />
        <Location />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(connectKeystore).toHaveBeenCalledWith(
        account.keystore.rootFingerprint,
        'messageSigning',
      );
    });
    expect(await screen.findByText('firmware upgrade required')).toBeInTheDocument();
    expect(screen.getByText('/market/bitsurance/account/btc-account')).toBeInTheDocument();
  });
});
