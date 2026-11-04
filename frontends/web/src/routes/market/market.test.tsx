// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/keystores', () => ({
  connectAnyKeystore: vi.fn(),
  connectKeystore: vi.fn(),
}));
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
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
  useConfig: vi.fn(),
}));
vi.mock('@/api/system', () => ({ open: vi.fn() }));
vi.mock('@/hooks/api', () => ({
  useLoad: () => undefined,
}));
vi.mock('@/hooks/lightning', () => ({
  useLightning: vi.fn(),
}));
vi.mock('./components/countryselect', () => ({
  CountrySelect: ({ onChangeRegion, regions, selectedRegion }: ComponentProps<typeof CountrySelect>) => (
    <select aria-label="region" value={selectedRegion} onChange={event => {
      onChangeRegion(regions.find(region => region.value === event.target.value) ?? null);
    }}>
      {regions.map(region => <option key={region.value} value={region.value}>{region.label}</option>)}
    </select>
  ),
}));
vi.mock('./components/deals', () => ({
  Deals: ({ goToVendor, action }: { goToVendor: (vendor: 'bitrefill' | 'btcdirect-otc' | 'pocket-otc') => void; action: string }) => (
    <>
      <button onClick={() => goToVendor('bitrefill')}>enter Bitrefill</button>
      {action === 'otc' && (
        <>
          <button onClick={() => goToVendor('btcdirect-otc')}>enter BTC Direct OTC</button>
          <button onClick={() => goToVendor('pocket-otc')}>enter Pocket OTC</button>
        </>
      )}
    </>
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
  useMarketContext: () => {
    const [selectedRegion, setSelectedRegion] = useState('CH');
    return {
      regions: [{ value: 'CH', label: 'Switzerland' }, { value: 'DE', label: 'Germany' }],
      selectedRegion,
      setSelectedRegion,
      showSwap: true,
    };
  },
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route, Switch, useLocation } from 'wouter';
import { useSearch } from '@/utils/router-compatability';
import { MemoryRouter } from '@/utils/test-helpers';
import type { TAccount } from '@/api/account';
import type { TConfig } from '@/api/config';
import { open } from '@/api/system';
import { alertUser } from '@/components/alert/Alert';
import { useConfig } from '@/contexts/ConfigProvider';
import { CountrySelect } from './components/countryselect';
import { getBTCDirectOTCLink, getPocketOTCLink } from './components/infocontent';
import type { TLightningAccount } from '@/api/lightning';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { useLightning } from '@/hooks/lightning';
import { AppStateContext } from '@/contexts/app-state-context';
import { AppNavigation } from '@/components/navigation';
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
const lightningAccount: TLightningAccount = { code: 'v0-test-ln-0', coinCode: 'lightning', rootFingerprint: 'test', num: 0 };

const setLightningAccount = (lightningAccount: TLightningAccount | null | undefined) => {
  vi.mocked(useLightning).mockReturnValue({
    lightningAccount,
    isLightningReady: false,
    lightningSDKStatus: 'inactive',
  });
};

const Location = () => {
  const [location] = useLocation();
  const search = useSearch();

  const { pathname } = new URL(
    location,
    window.location.origin,
  );

  return (
    <div>
      {pathname}{search && `?${search}`}
    </div>
  );
};

const MarketRoute = ({
  accounts,
  children = <Market />,
}: { accounts: TAccount[]; children?: ReactNode }) => {
  const { lightningAccount } = useLightning();
  return (
    <AppStateContext.Provider value={{
      accounts,
      activeAccounts: accounts,
      deviceIDs: [],
      devices: {},
      hasAccounts: !!accounts.length,
      hasBottomNavigation: false,
      hasDevices: false,
      lightningAccount,
      hasLightningAccount: !!lightningAccount,
    }}>
      <AppNavigation />
      {children}
    </AppStateContext.Provider>
  );
};

const renderMarket = (accounts: TAccount[], code = account.code, tab = 'spend') => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/market/select${code ? `/${code}` : ''}?tab=${tab}`]}>
      <Switch>
        <Route path="/market/select">{children}</Route>
        <Route path="/market/select/:code">{children}</Route>
      </Switch>
      <Location />
    </MemoryRouter>
  );
  return render(<MarketRoute accounts={accounts} />, { wrapper });
};

describe('routes/market/market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue({ config: { frontend: {}, backend: {} } as TConfig, setConfig: vi.fn() });
    vi.mocked(getBTCDirectOTCLink).mockReturnValue('https://start.btcdirect.eu/private-trading-bitbox');
    vi.mocked(getPocketOTCLink).mockReturnValue('https://pocketbitcoin.com/private?ref=bitbox');
    setLightningAccount(null);
  });

  // Keep the current region selected until the preference has been saved.
  it('changes the region only after saving succeeds', async () => {
    const config = { frontend: {}, backend: {} } as TConfig;
    let resolveSave!: (config: TConfig) => void;
    const setConfig = vi.fn(() => new Promise<TConfig>(resolve => {
      resolveSave = resolve;
    }));
    vi.mocked(useConfig).mockReturnValue({ config, setConfig });
    renderMarket([account]);

    fireEvent.change(screen.getByRole('combobox', { name: 'region' }), { target: { value: 'DE' } });

    expect(setConfig).toHaveBeenCalledExactlyOnceWith({ frontend: { selectedExchangeRegion: 'DE' } });
    expect(screen.getByRole('combobox', { name: 'region' })).toHaveValue('CH');
    await act(async () => resolveSave(config));
    expect(screen.getByRole('combobox', { name: 'region' })).toHaveValue('DE');
    expect(alertUser).not.toHaveBeenCalled();
  });

  // A rejected save must leave the previous region selected, report the error, and allow retrying.
  it('keeps the previous region after a failed save and allows retrying', async () => {
    const config = { frontend: {}, backend: {} } as TConfig;
    const setConfig = vi.fn().mockRejectedValueOnce(new Error('Failed to save configuration')).mockResolvedValue(config);
    vi.mocked(useConfig).mockReturnValue({ config, setConfig });
    renderMarket([account]);

    fireEvent.change(screen.getByRole('combobox', { name: 'region' }), { target: { value: 'DE' } });

    await waitFor(() => expect(alertUser).toHaveBeenCalledExactlyOnceWith('genericError'));
    expect(screen.getByRole('combobox', { name: 'region' })).toHaveValue('CH');

    fireEvent.change(screen.getByRole('combobox', { name: 'region' }), { target: { value: 'DE' } });

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'region' })).toHaveValue('DE'));
    expect(setConfig).toHaveBeenCalledTimes(2);
    expect(alertUser).toHaveBeenCalledTimes(1);
  });

  // Each OTC offer must consult its own saved flag, especially BTC Direct versus Bitsurance.
  it.each([
    ['BTC Direct OTC', 'btcdirect-otc', 'skipBTCDirectOTCDisclaimer', 'skipBitsuranceDisclaimer', 'https://start.btcdirect.eu/private-trading-bitbox'],
    ['Pocket OTC', 'pocket-otc', 'skipPocketOTCDisclaimer', 'skipBTCDirectOTCDisclaimer', 'https://pocketbitcoin.com/private?ref=bitbox'],
  ] as const)('requires independent acceptance for %s', async (label, vendor, key, otherKey, url) => {
    vi.mocked(useConfig).mockReturnValue({
      config: { ...({ frontend: {}, backend: {} } as TConfig), frontend: { [otherKey]: true } },
      setConfig: vi.fn(),
    });
    const { unmount } = renderMarket([account], account.code, 'otc');
    fireEvent.click(screen.getByRole('button', { name: `enter ${label}` }));
    expect(await screen.findByText(`/market/${vendor}`)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    unmount();

    vi.mocked(useConfig).mockReturnValue({
      config: { ...({ frontend: {}, backend: {} } as TConfig), frontend: { [key]: true } },
      setConfig: vi.fn(),
    });
    renderMarket([account], account.code, 'otc');
    fireEvent.click(screen.getByRole('button', { name: `enter ${label}` }));
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
    expect(screen.getByText(`/market/select/${account.code}?tab=otc`)).toBeInTheDocument();
  });

  // Losing the last on-chain account must leave its checkout even if Lightning remains available.
  it('redirects a disconnected on-chain checkout while Lightning remains available', () => {
    setLightningAccount(lightningAccount);
    const checkoutURL = `/market/bitrefill/spend/${account.code}/CH`;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[checkoutURL]}>{children}</MemoryRouter>
    );
    const { rerender } = render(<MarketRoute accounts={[account]}>{null}</MarketRoute>, { wrapper });
    expect(window.location.hash).toBe(`#${checkoutURL}`);

    rerender(<MarketRoute accounts={[]}>{null}</MarketRoute>);

    expect(window.location.hash).not.toContain('/market/');
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

  // Lightning discovery must finish before navigation treats the marketplace as empty.
  it('waits for Lightning discovery when no regular accounts are available', () => {
    setLightningAccount(undefined);
    const { rerender } = renderMarket([], '');
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
    expect(GroupedAccountSelector).not.toHaveBeenCalled();
    expect(screen.getByText('/market/select?tab=spend')).toBeInTheDocument();

    setLightningAccount(lightningAccount);
    rerender(<MarketRoute accounts={[]} />);
    expect(screen.getByRole('button', { name: 'enter Bitrefill' })).toBeVisible();
    expect(screen.getByText(`/market/select/${lightningAccount.code}?tab=spend`)).toBeInTheDocument();
  });

  // Once both account sources are empty, the marketplace redirects to the start screen.
  it('redirects an empty marketplace after account discovery finishes', () => {
    setLightningAccount(undefined);
    const { rerender } = renderMarket([], '');
    expect(screen.getByText('/market/select?tab=spend')).toBeInTheDocument();

    setLightningAccount(null);
    rerender(<MarketRoute accounts={[]} />);

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'enter Bitrefill' })).not.toBeInTheDocument();
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
