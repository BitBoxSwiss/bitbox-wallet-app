// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ContextType } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proposeTx, sendTx, type TAccount, type TAmountWithConversions } from '@/api/account';
import { parseExternalBtcAmount } from '@/api/coins';
import { AppContext } from '@/contexts/AppContext';
import { useAccountSynced } from '@/hooks/account';
import { Bitrefill } from './bitrefill';

vi.mock('@/components/layout', () => ({ Header: () => null }));
vi.mock('../settings/components/mobile-header', () => ({ MobileHeader: () => null }));
vi.mock('@/components/spinner/Spinner', () => ({ Spinner: () => null }));
vi.mock('./guide', () => ({ MarketGuide: () => null }));
vi.mock('./bitrefill-confirm', () => ({ ConfirmBitrefill: () => null }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: false }) }));
vi.mock('@/hooks/account', () => ({ useAccountSynced: vi.fn() }));
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

  const openWidget = (widgetUrl = `${bitrefillOrigin}/`) => {
    vi.mocked(useAccountSynced).mockReturnValue({
      success: true, url: isDevServers ? '/bitrefill/bitrefill.html' : hostedURL,
      widgetUrl,
      ref: 'test', address: 'test-refund-address',
    });
    render(
      <AppContext.Provider value={{ isDevServers } as ContextType<typeof AppContext>}>
        <Bitrefill accounts={[account]} code={account.code} region="" />
      </AppContext.Provider>
    );
    const wrapper = screen.getByTitle<HTMLIFrameElement>('Bitrefill');
    // jsdom does not download the wrapper document.
    wrapper.contentDocument!.write('<html><body></body></html>');
    const inner = document.createElement('iframe');
    wrapper.contentDocument!.body.appendChild(inner);
    return { wrapper, inner };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(parseExternalBtcAmount).mockResolvedValue({ success: true, amount: '0.001' });
    const amount: TAmountWithConversions = { amount: '0.001', unit: 'BTC', estimated: false };
    vi.mocked(proposeTx).mockResolvedValue({
      success: true, amount, fee: amount, total: amount, recipientDisplayAddress: payment.paymentAddress,
    });
    vi.mocked(sendTx).mockResolvedValue({ success: true, txId: 'test-txid' });
  });

  it('starts signing for a payment sent directly by the inner Bitrefill iframe', async () => {
    const { inner } = openWidget();
    await deliver(inner.contentWindow, bitrefillOrigin);
    expect(proposeTx).toHaveBeenCalledWith(account.code, {
      address: payment.paymentAddress, amount: '0.001', useHighestFee: true,
      sendAll: 'no', selectedUTXOs: [], paymentRequest: null,
    });
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('preserves payments relayed by the wrapper', async () => {
    const { wrapper } = openWidget();
    await deliver(wrapper.contentWindow, wrapperOrigin);
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('uses the widget origin supplied by the backend', async () => {
    const { inner } = openWidget('https://bitrefill-widget.test:8443/checkout');
    await deliver(inner.contentWindow, bitrefillOrigin);
    expect(sendTx).not.toHaveBeenCalled();
    await deliver(inner.contentWindow, 'https://bitrefill-widget.test:8443');
    expect(sendTx).toHaveBeenCalledTimes(1);
  });

  it('only sends configuration to the wrapper', async () => {
    const { wrapper, inner } = openWidget();
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
    const { wrapper, inner } = openWidget();
    await deliver(window, bitrefillOrigin);
    await deliver(inner.contentWindow, 'https://attacker.test');
    const unrelated = document.createElement('iframe');
    wrapper.contentDocument!.body.appendChild(unrelated);
    await deliver(unrelated.contentWindow, bitrefillOrigin);
    expect(proposeTx).not.toHaveBeenCalled();
    expect(sendTx).not.toHaveBeenCalled();
  });

  it('rejects payments from an inner iframe replaced by a new configuration', async () => {
    const { wrapper, inner } = openWidget();
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
    const { inner } = openWidget();
    inner.remove();
    await deliver(window, bitrefillOrigin);
    expect(sendTx).not.toHaveBeenCalled();
  });
});
