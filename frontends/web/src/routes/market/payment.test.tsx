// SPDX-License-Identifier: Apache-2.0

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { sendTx, type TAccount } from '@/api/account';
import { AppStateContext } from '@/contexts/app-state-context';
import { alertUser } from '@/components/alert/Alert';
import { Bitrefill } from './bitrefill';
import { BTCDirect } from './btcdirect';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('@/i18n/i18n', () => ({ i18n: { resolvedLanguage: 'en' } }));
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('@/components/layout', () => ({ Header: () => null }));
vi.mock('@/hooks/backbutton', () => ({ UseDisableBackButton: () => null }));
vi.mock('./guide', () => ({ MarketGuide: () => null }));
vi.mock('./bitrefill-confirm', () => ({ ConfirmBitrefill: () => null }));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: () => ({ config: { frontend: {
    skipBitrefillWidgetDisclaimer: true,
    skipBTCDirectWidgetDisclaimer: true,
  } } }),
}));
vi.mock('@/hooks/account', () => ({
  useAccountSynced: () => ({ success: true, url: 'https://vendor.example', widgetUrl: 'https://embed.bitrefill.com' }),
}));
vi.mock('@/api/coins', () => ({
  parseExternalBtcAmount: vi.fn().mockResolvedValue({ success: true, amount: '1' }),
}));
vi.mock('@/api/account', () => ({
  proposeTx: vi.fn().mockResolvedValue({ success: true }),
  sendTx: vi.fn(),
}));

const account: TAccount = {
  code: 'eth', coinCode: 'eth', coinUnit: 'ETH', coinName: 'Ethereum', name: 'Ethereum',
  active: true, isToken: false, blockExplorerTxPrefix: '',
  keystore: { connected: true, lastConnected: '', name: '', rootFingerprint: '', watchonly: false },
};

beforeEach(() => vi.clearAllMocks());

it.each([
  ['bitrefill', 'broadcastUncertain'],
  ['btcdirect', 'broadcastUncertain'],
  ['bitrefill', 'firmwareUpgradeRequired'],
  ['btcdirect', 'firmwareUpgradeRequired'],
] as const)('%s handles %s without canceling uncertain payments', async (vendor, errorCode) => {
  vi.mocked(sendTx).mockResolvedValue({
    success: false, errorCode, errorMessage: 'send failed',
  });
  render(
    <AppStateContext.Provider
      value={{
        accounts: [account],
        activeAccounts: [account],
        deviceIDs: [],
        devices: {},
        hasAccounts: true,
        hasBottomNavigation: false,
        hasDevices: false,
        lightningAccount: undefined,
        hasLightningAccount: false,
      }}
    >
      <MemoryRouter>
        {vendor === 'bitrefill'
          ? <Bitrefill code="eth" region="" />
          : <BTCDirect code="eth" action="sell" />}
      </MemoryRouter>
    </AppStateContext.Provider>
  );
  const iframe = screen.getByTitle<HTMLIFrameElement>(vendor === 'bitrefill' ? 'Bitrefill' : 'BTC Direct');
  const source = iframe.contentWindow!;
  const postMessage = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://vendor.example',
      source,
      data: vendor === 'bitrefill'
        ? { event: 'payment_intent', invoiceId: 'invoice', paymentMethod: 'ethereum', paymentAmount: '1', paymentAddress: '0x123' }
        : { action: 'request-payment', orderId: 'order', currency: 'ETH', amount: '1', walletAddress: '0x123' },
    }));
  });

  expect(sendTx).toHaveBeenCalledOnce();
  if (errorCode === 'broadcastUncertain') {
    expect(alertUser).toHaveBeenCalledWith('send.error.broadcastUncertain');
  } else {
    expect(alertUser).toHaveBeenCalledWith('unknownError');
  }
  if (errorCode === 'broadcastUncertain' || vendor === 'bitrefill') {
    expect(postMessage).not.toHaveBeenCalled();
  } else {
    expect(postMessage).toHaveBeenCalledWith({ action: 'cancel-order' }, 'https://vendor.example');
  }
});
