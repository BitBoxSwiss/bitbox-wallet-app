// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/keystores', () => ({
  connectAnyKeystore: vi.fn(),
  connectKeystore: vi.fn(),
}));
vi.mock('@/components/dialog/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: () => <div>firmware upgrade required</div>,
}));
vi.mock('@/components/forms', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));
vi.mock('@/components/groupedaccountselector/groupedaccountselector', () => ({
  GroupedAccountSelector: () => null,
}));
vi.mock('@/components/infobutton/infobutton', () => ({
  InfoButton: () => null,
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
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({ config: { frontend: {} }, setConfig: vi.fn() }),
}));
vi.mock('@/hooks/api', () => ({
  useLoad: () => undefined,
}));
vi.mock('@/hooks/vendor-iframe-terms', () => ({
  useVendorTerms: () => ({ agreedTerms: true }),
}));
vi.mock('./components/countryselect', () => ({
  CountrySelect: () => null,
}));
vi.mock('./components/deals', () => ({
  Deals: ({ goToVendor }: { goToVendor: (vendor: 'bitrefill') => void }) => (
    <button onClick={() => goToVendor('bitrefill')}>enter Bitrefill</button>
  ),
}));
vi.mock('./components/infocontent', () => ({
  getBTCDirectOTCLink: vi.fn(),
  getPocketOTCLink: vi.fn(),
  InfoContent: () => null,
}));
vi.mock('./components/markettab', () => ({
  MarketTab: () => null,
}));
vi.mock('./guide', () => ({
  MarketGuide: () => null,
}));
vi.mock('./market-context', () => ({
  useMarketContext: () => ({
    regions: [{ code: 'CH', name: 'Switzerland' }],
    selectedRegion: 'CH',
    setSelectedRegion: vi.fn(),
  }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { Market } from './market';

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
  return <div>{location.pathname}{location.search}</div>;
};

describe('routes/market/market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prompts for an upgrade before entering a signing workflow', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'firmwareUpgradeRequired',
    });

    render(
      <MemoryRouter initialEntries={['/market/select/btc-account?tab=spend']}>
        <Market accounts={[account]} code={account.code} />
        <Location />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    await waitFor(() => {
      expect(connectKeystore).toHaveBeenCalledWith(
        account.keystore.rootFingerprint,
        'btcTransactionSigning',
      );
    });
    expect(await screen.findByText('firmware upgrade required')).toBeInTheDocument();
    expect(screen.getByText('/market/select/btc-account?tab=spend')).toBeInTheDocument();
  });
});
