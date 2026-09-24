// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ComponentProps, ReactNode } from 'react';
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
  GroupedAccountSelector: vi.fn(({
    accounts, lightningAccount, onChange, selected,
  }: ComponentProps<typeof GroupedAccountSelector<TAccount>>) => (
    <select aria-label="account" value={selected} onChange={event => onChange(event.target.value)}>
      {accounts.map(account => <option key={account.code} value={account.code}>{account.name}</option>)}
      {lightningAccount && <option value={lightningAccount.code}>Lightning</option>}
    </select>
  )),
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
vi.mock('@/hooks/lightning', () => ({
  useLightning: vi.fn(),
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
vi.mock('./guide', () => ({
  MarketGuide: () => null,
}));
vi.mock('./market-context', () => ({
  useMarketContext: () => ({
    regions: [{ code: 'CH', name: 'Switzerland' }],
    selectedRegion: 'CH',
    setSelectedRegion: vi.fn(),
    showSwap: true,
  }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TLightningAccount } from '@/api/lightning';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { useLightning } from '@/hooks/lightning';
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
const lightningAccount: TLightningAccount = { code: 'v0-test-ln-0', rootFingerprint: 'test', num: 0 };

const setLightningAccount = (lightningAccount: TLightningAccount | null | undefined) => {
  vi.mocked(useLightning).mockReturnValue({
    lightningAccount,
    isLightningReady: false,
    lightningSDKStatus: 'inactive',
  });
};

const Location = () => {
  const location = useLocation();
  return <div>{location.pathname}{location.search}</div>;
};

const MarketRoute = ({ accounts }: { accounts: TAccount[] | undefined }) => {
  const { code = '' } = useParams();
  return <Market accounts={accounts} code={code} />;
};

const renderMarket = (accounts: TAccount[] | undefined, code = account.code, tab = 'spend') => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/market/select${code ? `/${code}` : ''}?tab=${tab}`]}>
      <Routes>
        <Route path="/market/select" element={children} />
        <Route path="/market/select/:code" element={children} />
        <Route path="*" element={null} />
      </Routes>
      <Location />
    </MemoryRouter>
  );
  return render(<MarketRoute accounts={accounts} />, { wrapper });
};

describe('routes/market/market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLightningAccount(null);
  });

  it.each(['', lightningAccount.code])('only offers Spend with a Lightning-only account and enters Bitrefill without a device (code: "%s")', async code => {
    setLightningAccount(lightningAccount);
    renderMarket([], code, 'buy');

    expect(screen.getByRole('button', { name: 'buy.exchange.spend' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'buy.exchange.buy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'buy.exchange.sell' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generic.swap/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /OTC/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'generic.insure' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'account' })).toHaveValue(lightningAccount.code);
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    expect(await screen.findByText(`/market/bitrefill/spend/${lightningAccount.code}/CH`)).toBeInTheDocument();
    expect(connectKeystore).not.toHaveBeenCalled();
    expect(connectAnyKeystore).not.toHaveBeenCalled();
  });

  it('offers all tabs for mixed accounts and lets Lightning enter Bitrefill from Spend without a device', async () => {
    setLightningAccount(lightningAccount);
    renderMarket([account], account.code, 'buy');

    expect(screen.getByRole('button', { name: 'buy.exchange.buy' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'buy.exchange.sell' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'buy.exchange.spend' })).toBeVisible();
    expect(screen.getByRole('button', { name: /generic.swap/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /OTC/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'generic.insure' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'account' })).toHaveValue(account.code);
    expect(screen.queryByRole('option', { name: 'Lightning' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'buy.exchange.spend' }));
    expect(screen.getByRole('option', { name: 'Lightning' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'account' }), { target: { value: lightningAccount.code } });
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    expect(await screen.findByText(`/market/bitrefill/spend/${lightningAccount.code}/CH`)).toBeInTheDocument();
    expect(connectKeystore).not.toHaveBeenCalled();
    expect(connectAnyKeystore).not.toHaveBeenCalled();
  });

  it.each([undefined, lightningAccount])('connects the regular account before entering Bitrefill regardless of Lightning discovery (%s)', async discovered => {
    setLightningAccount(discovered);
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    renderMarket([account]);

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    expect(await screen.findByText(`/market/bitrefill/spend/${account.code}/CH`)).toBeInTheDocument();
    expect(connectKeystore).toHaveBeenCalledExactlyOnceWith(account.keystore.rootFingerprint, 'btcTransactionSigning');
  });

  it.each([account.code, ''])('renders regular accounts while Lightning is unresolved (code: "%s")', code => {
    setLightningAccount(undefined);
    const { rerender } = renderMarket([account], code);

    expect(screen.getByRole('button', { name: 'enter Bitrefill' })).toBeVisible();
    expect(screen.getByText('/market/select/btc-account?tab=spend')).toBeInTheDocument();
    expect(GroupedAccountSelector).toHaveBeenLastCalledWith(expect.objectContaining({
      accounts: [account], selected: account.code, lightningAccount: undefined,
    }), expect.anything());

    setLightningAccount(lightningAccount);
    rerender(<MarketRoute accounts={[account]} />);

    expect(GroupedAccountSelector).toHaveBeenLastCalledWith(expect.objectContaining({
      accounts: [account], selected: account.code, lightningAccount,
    }), expect.anything());
    expect(screen.getByText('/market/select/btc-account?tab=spend')).toBeInTheDocument();
  });

  it('waits for regular accounts to finish loading', () => {
    setLightningAccount(lightningAccount);
    renderMarket(undefined);
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
    expect(GroupedAccountSelector).not.toHaveBeenCalled();
  });

  it('waits for Lightning discovery when no regular accounts are available', () => {
    setLightningAccount(undefined);
    const { rerender } = renderMarket([], '');
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
    expect(GroupedAccountSelector).not.toHaveBeenCalled();

    setLightningAccount(lightningAccount);
    rerender(<MarketRoute accounts={[]} />);
    expect(screen.getByRole('button', { name: 'enter Bitrefill' })).toBeVisible();
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();
  });

  it('keeps checkout unavailable until the Lightning account in the URL is discovered', async () => {
    setLightningAccount(undefined);
    const { rerender } = renderMarket([account], lightningAccount.code);
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();
    expect(GroupedAccountSelector).toHaveBeenLastCalledWith(expect.objectContaining({
      selected: undefined,
    }), expect.anything());

    setLightningAccount(lightningAccount);
    rerender(<MarketRoute accounts={[account]} />);
    expect(GroupedAccountSelector).toHaveBeenLastCalledWith(expect.objectContaining({
      selected: lightningAccount.code, lightningAccount,
    }), expect.anything());
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    expect(await screen.findByText(`/market/bitrefill/spend/${lightningAccount.code}/CH`)).toBeInTheDocument();
    expect(connectKeystore).not.toHaveBeenCalled();
    expect(connectAnyKeystore).not.toHaveBeenCalled();
  });

  it.each([null, lightningAccount])('uses the regular fallback once discovery rules out an unknown account (%s)', async discovered => {
    setLightningAccount(undefined);
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    const { rerender } = renderMarket([account], 'unknown-account');
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
    expect(screen.getByText('/market/select/unknown-account?tab=spend')).toBeInTheDocument();

    setLightningAccount(discovered);
    rerender(<MarketRoute accounts={[account]} />);
    expect(screen.getByText('/market/select/btc-account?tab=spend')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'enter Bitrefill' }));

    expect(await screen.findByText(`/market/bitrefill/spend/${account.code}/CH`)).toBeInTheDocument();
    expect(connectKeystore).toHaveBeenCalledExactlyOnceWith(account.keystore.rootFingerprint, 'btcTransactionSigning');
  });

  it('prompts for an upgrade before entering a signing workflow', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({
      success: false,
      errorCode: 'firmwareUpgradeRequired',
    });

    renderMarket([account]);

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
