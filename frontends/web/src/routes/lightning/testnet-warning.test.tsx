// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTesting } from '@/api/backend';
import { Testing } from '@/components/banners/testing';
import { AppProvider } from '@/contexts/AppProvider';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import translations from '@/locales/en/app.json';
import { AppRouter } from '../router';

const mocks = vi.hoisted(() => ({
  lightningPage: vi.fn((): JSX.Element => <p>Lightning page</p>),
  setConfig: vi.fn(),
}));

vi.mock('@/i18n/i18n');
vi.mock('@/api/backend', () => ({
  getTesting: vi.fn(),
  getDevServers: () => Promise.resolve(false),
}));
vi.mock('@/api/nativelocale', () => ({
  getNativeLocale: () => Promise.resolve('en'),
}));
vi.mock('@/api/online', () => ({
  getOnline: () => Promise.resolve(true),
  subscribeOnline: () => () => {},
}));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({ config: undefined, setConfig: mocks.setConfig }),
}));
vi.mock('@/hooks/lightning', () => ({
  useLightning: () => ({ isLightningAvailable: true }),
}));
vi.mock('./lightning', () => ({ Lightning: mocks.lightningPage }));
vi.mock('./send/send', () => ({ Send: mocks.lightningPage }));
vi.mock('./activate', () => ({ LightningActivate: mocks.lightningPage }));
vi.mock('../settings/lightning-settings', () => ({ LightningSettings: mocks.lightningPage }));
vi.mock('../device/deviceswitch', () => ({ DeviceSwitch: () => <p>Home page</p> }));
vi.mock('../settings/advanced-settings', () => ({ AdvancedSettings: () => <p>Advanced settings</p> }));

const Navigation = (): JSX.Element => {
  const { pathname, search } = useLocation();
  return (
    <nav>
      <Link to="/settings/advanced-settings">Leave Lightning</Link>
      <Link to="/lightning">Open Lightning</Link>
      <Link to="/settings/lightning-settings">Open Lightning settings</Link>
      <output aria-label="Current location">{pathname}{search}</output>
    </nav>
  );
};

const renderApp = (path = '/lightning', previousPath?: string) => render(
  <MemoryRouter initialEntries={previousPath ? [previousPath, path] : [path]}>
    <AppProvider>
      <BackButtonProvider>
        <Navigation />
        <Testing />
        <AppRouter
          accounts={[]}
          activeAccounts={[]}
          devices={{}}
          devicesKey={prefix => prefix}
          showBottomNavigation={false}
        />
      </BackButtonProvider>
    </AppProvider>
  </MemoryRouter>,
);

const warning = () => screen.findByText(translations.lightning.testnetWarning.title);
const acknowledge = async () => {
  await userEvent.click(await screen.findByRole('checkbox', { name: translations.lightning.testnetWarning.checkboxLabel }));
  await userEvent.click(screen.getByRole('button', { name: translations.button.done }));
};

describe('Lightning in testnet mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTesting).mockResolvedValue(true);
  });

  it.each([
    '/lightning',
    '/lightning/',
    '/lightning/activate/',
    '/lightning/disclaimer',
    '/lightning/deactivate',
    '/lightning/set-lnurl-address',
    '/lightning/claim-top-up',
    '/lightning/close-withdraw-funds',
    '/lightning/send',
    '/lightning/receive',
    '/lightning/topup',
    '/LIGHTNING/send',
    '/light%6eing',
  ])('warns before opening %s and hides the testnet banner', async path => {
    renderApp(path);

    expect(await warning()).toBeInTheDocument();
    expect(screen.getByText(translations.lightning.testnetWarning.message)).toBeInTheDocument();
    expect(mocks.lightningPage).not.toHaveBeenCalled();
    expect(screen.queryByText(translations.warning.testnet)).not.toBeInTheDocument();
  });

  it('keeps the requested destination and remembers acceptance across navigation', async () => {
    const path = '/lightning/send?paymentRequest=demo';
    renderApp(path);
    await acknowledge();

    expect(screen.getByText('Lightning page')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Current location' })).toHaveTextContent(path);
    expect(screen.queryByText(translations.warning.testnet)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Leave Lightning' }));
    expect(await screen.findByText(translations.warning.testnet)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Open Lightning settings' }));
    expect(screen.getByText('Lightning page')).toBeInTheDocument();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();
    expect(screen.getByText(translations.warning.testnet)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Open Lightning' }));
    expect(screen.getByText('Lightning page')).toBeInTheDocument();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();
    expect(mocks.setConfig).not.toHaveBeenCalled();
  });

  it('warns again in a new app session', async () => {
    const { unmount } = renderApp();
    await acknowledge();
    expect(screen.getByText('Lightning page')).toBeInTheDocument();
    unmount();

    renderApp();
    expect(await warning()).toBeInTheDocument();
    expect(screen.queryByText('Lightning page')).not.toBeInTheDocument();
    expect(mocks.setConfig).not.toHaveBeenCalled();
  });

  it('requires the checkbox before allowing Done', async () => {
    renderApp();
    const checkbox = await screen.findByRole('checkbox', { name: translations.lightning.testnetWarning.checkboxLabel });
    const done = screen.getByRole('button', { name: translations.button.done });

    expect(checkbox).not.toBeChecked();
    expect(done).toBeDisabled();
    await userEvent.click(done);
    expect(mocks.lightningPage).not.toHaveBeenCalled();

    await userEvent.click(checkbox);
    expect(done).toBeEnabled();
    await userEvent.click(checkbox);
    expect(done).toBeDisabled();
  });

  it('returns to the previous page on X without accepting the warning', async () => {
    const previousPath = '/settings/advanced-settings?search=lightning';
    renderApp('/lightning', previousPath);
    await userEvent.click(await screen.findByRole('checkbox', { name: translations.lightning.testnetWarning.checkboxLabel }));
    await userEvent.click(screen.getByTestId('close-button'));

    expect(await screen.findByText('Advanced settings')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Current location' })).toHaveTextContent(previousPath);
    expect(mocks.lightningPage).not.toHaveBeenCalled();
    expect(await screen.findByText(translations.warning.testnet)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Open Lightning' }));
    expect(await warning()).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: translations.button.done })).toBeDisabled();
  });

  it('returns home on X when opened directly without an earlier page', async () => {
    renderApp();
    await userEvent.click(await screen.findByTestId('close-button'));

    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(mocks.lightningPage).not.toHaveBeenCalled();
  });

  it('treats the system back button as cancellation', async () => {
    renderApp('/lightning', '/settings/advanced-settings');
    await warning();

    act(() => {
      window.onBackButtonPressed?.();
    });

    expect(await screen.findByText('Advanced settings')).toBeInTheDocument();
    expect(mocks.lightningPage).not.toHaveBeenCalled();
  });

  it('waits for the network mode before mounting a Lightning page', async () => {
    let resolveTesting: (testing: boolean) => void = () => {};
    vi.mocked(getTesting).mockReturnValue(new Promise(resolve => {
      resolveTesting = resolve;
    }));
    renderApp();

    expect(mocks.lightningPage).not.toHaveBeenCalled();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();

    await act(async () => resolveTesting(true));
    expect(await warning()).toBeInTheDocument();
    expect(mocks.lightningPage).not.toHaveBeenCalled();
  });

  it('does not show a warning or testnet banner on mainnet', async () => {
    vi.mocked(getTesting).mockResolvedValue(false);
    renderApp();

    expect(await screen.findByText('Lightning page')).toBeInTheDocument();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();
    expect(screen.queryByText(translations.warning.testnet)).not.toBeInTheDocument();
  });

  it.each([
    '/settings/advanced-settings',
    '/settings/lightning-settings',
    '/settings/lightning-settings/',
  ])('keeps the testnet banner on %s without showing the Lightning warning', async path => {
    renderApp(path);

    expect(await screen.findByText(translations.warning.testnet)).toBeInTheDocument();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();
  });

  it('still warns on entering the account after visiting Lightning settings', async () => {
    renderApp('/settings/lightning-settings');
    expect(await screen.findByText('Lightning page')).toBeInTheDocument();
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Open Lightning' }));
    expect(await warning()).toBeInTheDocument();
  });
});
