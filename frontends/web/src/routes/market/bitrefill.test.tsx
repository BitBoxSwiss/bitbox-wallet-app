// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ComponentProps, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, Route, Switch } from 'wouter';
import { MemoryRouter } from '@/utils/test-helpers';
import { proposeTx, sendTx, type TAccount, type TAmountWithConversions } from '@/api/account';
import { parseExternalBtcAmount } from '@/api/coins';
import { getDevServers } from '@/api/backend';
import { Testing } from '@/components/banners/testing';
import { AppProvider } from '@/contexts/AppProvider';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { AppStateContext } from '@/contexts/app-state-context';
import { useAccountSynced } from '@/hooks/account';
import { useLightning } from '@/hooks/lightning';
import { Send as LightningSend } from '@/routes/lightning/send/send';
import { LightningTestnetGuard } from '@/routes/lightning/testnet-warning';
import translations from '@/locales/en/app.json';
import { Bitrefill } from './bitrefill';

vi.mock('@/components/layout', () => ({
  Header: () => null,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/i18n/i18n');
vi.mock('@/api/backend', () => ({
  getTesting: () => Promise.resolve(true),
  getDevServers: vi.fn(),
}));
vi.mock('@/api/nativelocale', () => ({
  getNativeLocale: () => Promise.resolve('en'),
}));
vi.mock('@/api/online', () => ({
  getOnline: () => Promise.resolve(true),
  subscribeOnline: () => () => {},
}));
vi.mock('../settings/components/mobile-header', () => ({ MobileHeader: () => null }));
vi.mock('@/components/spinner/Spinner', () => ({ Spinner: () => null }));
vi.mock('./guide', () => ({ MarketGuide: () => null }));
vi.mock('./bitrefill-confirm', () => ({ ConfirmBitrefill: () => null }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: false }) }));
vi.mock('@/hooks/account', () => ({ useAccountSynced: vi.fn() }));
vi.mock('@/hooks/lightning', () => ({ useLightning: vi.fn() }));
vi.mock('@/routes/lightning/send/send', () => ({
  Send: ({ initialPaymentInput, onClose }: ComponentProps<typeof LightningSend>) => (
    <div>
      <span>{initialPaymentInput}</span>
      <button onClick={() => onClose?.()}>complete payment</button>
    </div>
  ),
}));
vi.mock('@/hooks/vendor-iframe-active', () => ({ useMarketIframeActive: vi.fn() }));
vi.mock('@/hooks/vendor-iframe-terms', () => ({
  useVendorTerms: () => ({ agreedTerms: true, setAgreedTerms: vi.fn() }),
}));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({ config: { frontend: {} } }),
}));
vi.mock('@/api/account', () => ({ proposeTx: vi.fn(), sendTx: vi.fn() }));
vi.mock('@/api/coins', () => ({ parseExternalBtcAmount: vi.fn() }));

const account: TAccount = {
  keystore: { connected: true, lastConnected: '', name: 'BitBox02', rootFingerprint: 'test', watchonly: false },
  active: true, blockExplorerTxPrefix: '', code: 'btc-account', coinCode: 'btc',
  coinName: 'Bitcoin', coinUnit: 'BTC', isToken: false, name: 'Bitcoin',
};
const bitrefillOrigin = 'https://embed.bitrefill.com';
const hostedURL = 'https://bitboxapp.shiftcrypto.io/widgets/bitrefill/v1/bitrefill.html';
const payment = {
  event: 'payment_intent', invoiceId: 'invoice', paymentMethod: 'bitcoin',
  paymentAmount: '0.001', paymentAddress: 'test-payment-address',
};

// MessageEvent.source models Bitrefill's window.top.postMessage: the sender is
// the inner vendor window, even though the app only renders the outer wrapper.
const deliver = async (source: Window | null, origin: string, data: unknown = payment) => {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { source, origin, data: JSON.stringify(data) }));
  });
};

describe.each([false, true])('Bitrefill messages (dev servers: %s)', isDevServers => {
  const wrapperOrigin = isDevServers ? window.location.origin : new URL(hostedURL).origin;

  const openWidget = async (widgetUrl = `${bitrefillOrigin}/`, code = account.code) => {
    vi.mocked(useAccountSynced).mockReturnValue({
      success: true, url: isDevServers ? '/bitrefill/bitrefill.html' : hostedURL,
      widgetUrl,
      ref: 'test', address: 'test-refund-address',
    });
    render(
      <AppProvider>
        <AppStateContext.Provider
          value={{
            accounts: [account],
            activeAccounts: [account],
            deviceIDs: [],
            devices: {},
            hasAccounts: false,
            hasBottomNavigation: false,
            hasDevices: false,
            lightningAccount: undefined,
            hasLightningAccount: false,
          }}
        >
          <MemoryRouter initialEntries={[`/market/bitrefill/spend/${code}`]}>
            <BackButtonProvider>
              <Link to="/">Leave checkout</Link>
              <Testing />
              <LightningTestnetGuard active={false}>
                <Switch>
                  <Route path="/">Home page</Route>
                  <Route
                    path="/market/bitrefill/spend/:code"
                    component={Bitrefill}
                  />
                </Switch>
              </LightningTestnetGuard>
            </BackButtonProvider>
          </MemoryRouter>
        </AppStateContext.Provider>
      </AppProvider>
    );
    expect(await screen.findByText(translations.warning.testnet)).toBeInTheDocument();
    const wrapper = screen.getByTitle<HTMLIFrameElement>('Bitrefill');
    // jsdom does not download the wrapper document.
    wrapper.contentDocument!.write('<html><body></body></html>');
    const inner = document.createElement('iframe');
    wrapper.contentDocument!.body.appendChild(inner);
    return { wrapper, inner };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDevServers).mockResolvedValue(isDevServers);
    vi.mocked(useLightning).mockReturnValue({
      lightningAccount: null,
      isLightningReady: false,
      lightningSDKStatus: 'inactive',
    });
    vi.mocked(parseExternalBtcAmount).mockResolvedValue({ success: true, amount: '0.001' });
    const amount: TAmountWithConversions = { amount: '0.001', unit: 'BTC', estimated: false };
    vi.mocked(proposeTx).mockResolvedValue({
      success: true, amount, fee: amount, total: amount, recipientDisplayAddress: payment.paymentAddress,
    });
    vi.mocked(sendTx).mockResolvedValue({ success: true, txId: 'test-txid' });
  });

  // Lightning payment review must retain the checkout iframe and its order state on return.
  it('keeps the Bitrefill checkout mounted during a Lightning payment', async () => {
    const lightningAccount = {
      code: 'v0-test-ln-0', coinCode: 'lightning' as const, coinUnit: 'BTC' as const,
      rootFingerprint: 'test', num: 0,
    };
    vi.mocked(useLightning).mockReturnValue({
      lightningAccount,
      isLightningReady: true,
      lightningSDKStatus: 'ready',
    });
    const { wrapper, inner } = await openWidget(undefined, lightningAccount.code);
    fireEvent.load(wrapper);
    const checkoutWindow = inner.contentWindow;
    const lightningPayment = {
      ...payment, paymentMethod: 'lightning', paymentAddress: 'lnbc1bitrefill',
    };

    await deliver(checkoutWindow, bitrefillOrigin, lightningPayment);

    expect(screen.getByText(translations.lightning.testnetWarning.title)).toBeInTheDocument();
    expect(screen.queryByText('lnbc1bitrefill')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: translations.generic.iHaveReadTheInformation }));
    fireEvent.click(screen.getByRole('button', { name: translations.button.done }));

    expect(screen.getByText('lnbc1bitrefill')).toBeVisible();
    expect(screen.getByTitle('Bitrefill')).toBe(wrapper);
    expect(wrapper).not.toBeVisible();
    expect(proposeTx).not.toHaveBeenCalled();
    expect(sendTx).not.toHaveBeenCalled();
    expect(parseExternalBtcAmount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'complete payment' }));

    expect(screen.queryByText('lnbc1bitrefill')).not.toBeInTheDocument();
    expect(screen.getByTitle('Bitrefill')).toBe(wrapper);
    expect(wrapper).toBeVisible();
    expect(inner.contentWindow).toBe(checkoutWindow);
    expect(screen.getByText(translations.warning.testnet)).toBeInTheDocument();

    await deliver(checkoutWindow, bitrefillOrigin, lightningPayment);
    expect(screen.getByText('lnbc1bitrefill')).toBeVisible();

    fireEvent.click(screen.getByRole('link', { name: 'Leave checkout' }));
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.getByText(translations.warning.testnet)).toBeInTheDocument();
  });

  // Cancelling the embedded warning must preserve checkout and allow a fresh payment attempt.
  it.each(['close button', 'system back'])('restores checkout after cancelling the Lightning warning via %s', async cancelVia => {
    const lightningAccount = {
      code: 'v0-test-ln-0', coinCode: 'lightning' as const, coinUnit: 'BTC' as const,
      rootFingerprint: 'test', num: 0,
    };
    vi.mocked(useLightning).mockReturnValue({
      lightningAccount,
      isLightningReady: true,
      lightningSDKStatus: 'ready',
    });
    const { wrapper, inner } = await openWidget(undefined, lightningAccount.code);
    fireEvent.load(wrapper);
    const checkoutWindow = inner.contentWindow;
    const checkoutLocation = window.location.hash;
    const lightningPayment = {
      ...payment, paymentMethod: 'lightning', paymentAddress: 'lnbc1bitrefill',
    };

    await deliver(checkoutWindow, bitrefillOrigin, lightningPayment);
    fireEvent.click(screen.getByRole('checkbox', { name: translations.generic.iHaveReadTheInformation }));

    if (cancelVia === 'close button') {
      fireEvent.click(screen.getByTestId('close-button'));
    } else {
      act(() => window.onBackButtonPressed?.());
    }

    await waitFor(() => expect(wrapper).toBeVisible());
    expect(window.location.hash).toBe(checkoutLocation);
    expect(screen.queryByText(translations.lightning.testnetWarning.title)).not.toBeInTheDocument();
    expect(screen.queryByText('lnbc1bitrefill')).not.toBeInTheDocument();
    expect(screen.getByTitle('Bitrefill')).toBe(wrapper);
    expect(wrapper).toBeVisible();
    expect(inner.contentWindow).toBe(checkoutWindow);

    await deliver(checkoutWindow, bitrefillOrigin, lightningPayment);

    expect(screen.getByText(translations.lightning.testnetWarning.title)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: translations.generic.iHaveReadTheInformation })).not.toBeChecked();
    expect(screen.getByRole('button', { name: translations.button.done })).toBeDisabled();
    expect(screen.queryByText('lnbc1bitrefill')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: translations.generic.iHaveReadTheInformation }));
    fireEvent.click(screen.getByRole('button', { name: translations.button.done }));
    expect(screen.getByText('lnbc1bitrefill')).toBeVisible();
  });

  it('starts signing for a payment sent directly by the inner Bitrefill iframe', async () => {
    const { inner } = await openWidget();
    await deliver(inner.contentWindow, bitrefillOrigin);
    expect(proposeTx).toHaveBeenCalledWith(account.code, {
      address: payment.paymentAddress, amount: '0.001', useHighestFee: true,
      sendAll: 'no', selectedUTXOs: [], paymentRequest: null,
    });
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('preserves payments relayed by the wrapper', async () => {
    const { wrapper } = await openWidget();
    await deliver(wrapper.contentWindow, wrapperOrigin);
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('uses the widget origin supplied by the backend', async () => {
    const { inner } = await openWidget('https://bitrefill-widget.test:8443/checkout');
    await deliver(inner.contentWindow, bitrefillOrigin);
    expect(sendTx).not.toHaveBeenCalled();
    await deliver(inner.contentWindow, 'https://bitrefill-widget.test:8443');
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('only sends configuration to the wrapper', async () => {
    const { wrapper, inner } = await openWidget();
    const reply = vi.spyOn(wrapper.contentWindow!, 'postMessage').mockImplementation(() => {});
    const innerReply = vi.spyOn(inner.contentWindow!, 'postMessage').mockImplementation(() => {});
    await deliver(inner.contentWindow, bitrefillOrigin, { event: 'request-configuration' });
    expect(innerReply).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
    await deliver(wrapper.contentWindow, wrapperOrigin, { event: 'request-configuration' });
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({
      event: 'configuration', refundAddress: 'test-refund-address',
    }), wrapperOrigin);
  });

  it('rejects another window at the Bitrefill origin and the inner iframe at another origin', async () => {
    const { wrapper, inner } = await openWidget();
    await deliver(window, bitrefillOrigin);
    await deliver(inner.contentWindow, 'https://attacker.test');
    const unrelated = document.createElement('iframe');
    wrapper.contentDocument!.body.appendChild(unrelated);
    await deliver(unrelated.contentWindow, bitrefillOrigin);
    expect(proposeTx).not.toHaveBeenCalled();
    expect(sendTx).not.toHaveBeenCalled();
  });

  it('rejects payments from an inner iframe replaced by a new configuration', async () => {
    const { wrapper, inner } = await openWidget();
    const oldWindow = inner.contentWindow;
    inner.remove();
    const replacement = document.createElement('iframe');
    wrapper.contentDocument!.body.appendChild(replacement);
    await deliver(oldWindow, bitrefillOrigin);
    expect(sendTx).not.toHaveBeenCalled();
    await deliver(replacement.contentWindow, bitrefillOrigin);
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('ignores payments when the wrapper has no inner iframe yet', async () => {
    const { inner } = await openWidget();
    inner.remove();
    await deliver(window, bitrefillOrigin);
    expect(sendTx).not.toHaveBeenCalled();
  });
});
