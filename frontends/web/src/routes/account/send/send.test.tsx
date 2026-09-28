// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as accountApi from '@/api/account';
import * as accountSync from '@/api/accountsync';
import * as coinsApi from '@/api/coins';
import * as keystoresApi from '@/api/keystores';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode } from '@/api/lightning-errors';
import type { TConfig } from '@/api/config';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { RatesContext } from '@/contexts/RatesContext';
import { LightningContext } from '@/contexts/LightningContext';
import * as mediaQuery from '@/hooks/mediaquery';
import { i18n } from '@/i18n/i18n';
import type { NonEmptyArray } from '@/utils/types';
import type { TSelectedUTXOs } from './utxos';
import { Send } from './send';

vi.mock('@/i18n/i18n');
vi.mock('./send-guide', () => ({ SendGuide: () => null }));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({ FirmwareUpgradeRequiredDialog: () => null }));
vi.mock('@/contexts/ConfigProvider', () => {
  const config = { frontend: { expertFee: true } } as TConfig;
  return { useConfig: () => ({ config, setConfig: vi.fn() }) };
});
vi.mock('./coin-control', () => ({
  CoinControl: ({ onSelectedUTXOsChange }: { onSelectedUTXOsChange: (coins: TSelectedUTXOs) => void }): JSX.Element => (
    <button onClick={() => onSelectedUTXOsChange({ 'txid:1': 'source-address' })}>Select coin</button>
  ),
}));

const account: accountApi.TAccount = {
  keystore: {
    watchonly: false, rootFingerprint: '1234', name: 'BitBox02', lastConnected: '', connected: true,
  },
  active: true, coinCode: 'btc', coinUnit: 'BTC', coinName: 'Bitcoin', code: 'btc-account',
  name: 'Bitcoin Account', isToken: false, blockExplorerTxPrefix: '',
};
const amount = (value: string): accountApi.TAmountWithConversions => ({ amount: value, unit: 'sat', estimated: false });
const proposal: accountApi.TTxProposalResult = {
  success: true, amount: amount('9900'), fee: amount('100'), total: amount('10000'), recipientDisplayAddress: 'bc1q boarding',
};

const renderSend = (source = account, ready: boolean | undefined = true, enabled = true, activeAccounts?: accountApi.TAccount[]) => render(
  <MemoryRouter>
    <BackButtonProvider>
      <LightningContext.Provider value={{
        lightningAccount: enabled ? { code: 'lightning', rootFingerprint: '5678', num: 0 } : null,
        isLightningReady: ready,
        lightningSDKStatus: ready ? 'ready' : 'initializing',
      }}>
        <RatesContext.Provider value={{
          defaultCurrency: 'USD', activeCurrencies: ['USD'], btcUnit: 'sat',
          rotateDefaultCurrency: vi.fn(), rotateBtcUnit: vi.fn(), addToActiveCurrencies: vi.fn(),
          updateDefaultCurrency: vi.fn(), removeFromActiveCurrencies: vi.fn(),
        }}>
          <Send account={source} activeAccounts={activeAccounts} />
        </RatesContext.Provider>
      </LightningContext.Provider>
    </BackButtonProvider>
  </MemoryRouter>
);

const setAmountAndFee = async () => {
  fireEvent.input(await screen.findByRole('spinbutton', { name: 'sat' }), { target: { value: '10000' } });
  fireEvent.input(await screen.findByRole('spinbutton', { name: /Fee rate/ }), { target: { value: '2' } });
};

const selectLightning = async () => {
  expect(screen.queryByRole('button', { name: 'Send to Lightning' })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByText('Select account'));
  const option = await screen.findByRole('option', { name: /Lightning/ });
  await act(async () => {
    fireEvent.click(option);
  });
};

describe('Send to Lightning', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(accountSync, 'syncdone').mockReturnValue(vi.fn());
    vi.spyOn(accountSync, 'statusChanged').mockReturnValue(vi.fn());
    vi.spyOn(accountApi, 'getStatus').mockResolvedValue({ synced: true } as accountApi.TStatus);
    vi.spyOn(accountApi, 'getBalance').mockResolvedValue({
      success: true,
      balance: { available: amount('10000'), incoming: amount('0'), hasAvailable: true, hasIncoming: false },
    });
    vi.spyOn(accountApi, 'getFeeTargetList').mockResolvedValue({ defaultFeeTarget: 'custom', feeTargets: [] });
    vi.spyOn(accountApi, 'proposeTx').mockResolvedValue(proposal);
    vi.spyOn(accountApi, 'getReceiveAddressList').mockReturnValue(async () => [{
      scriptType: null,
      addresses: [{ addressID: '0', address: 'bc1qordinary', displayAddress: 'bc1qordinary' }],
    }]);
    vi.spyOn(lightningApi, 'getBoardingAddress').mockResolvedValue('bc1qboarding');
    vi.spyOn(lightningApi, 'postPrepareTopUp').mockResolvedValue(proposal);
    vi.spyOn(coinsApi, 'convertToCurrency').mockResolvedValue({ success: true, fiatAmount: '1' });
    vi.spyOn(keystoresApi, 'connectKeystore').mockResolvedValue({ success: true });
    vi.spyOn(keystoresApi, 'getKeystoreFeatures').mockResolvedValue({
      success: true, features: { supportsSendToSelf: true },
    });
  });

  it('prefills and locks recipient, supports selected-coin send-all, and uses BTC signing', async () => {
    const send = vi.spyOn(accountApi, 'sendTx').mockReturnValue(new Promise(() => {}));
    renderSend(account, true, true, [account]);
    await setAmountAndFee();
    fireEvent.input(screen.getByRole('textbox', { name: /Note/ }), { target: { value: 'My note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select coin' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send selected coins' }));
    await selectLightning();
    const recipient = screen.getByRole('textbox', { name: 'Receiver address' });
    await waitFor(() => expect(recipient).toHaveValue('bc1qboarding'));
    expect(recipient).toHaveAttribute('readonly');
    expect(screen.queryByText('Select account')).not.toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(keystoresApi.connectKeystore).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled());
    expect(lightningApi.postPrepareTopUp).toHaveBeenLastCalledWith({
      sourceAccountCode: account.code, amount: '10000', feeTarget: 'custom', customFee: '2',
      sendAll: 'yes', selectedUTXOs: ['txid:1'], expectedAddress: 'bc1qboarding',
    });
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith(account.code, 'My note'));
    expect(keystoresApi.connectKeystore).toHaveBeenCalledWith('1234');
    expect(screen.getByText('bc1q boarding')).toBeInTheDocument();
    expect(screen.getAllByText('Lightning')).toHaveLength(2);
  });

  it('Reset preserves amount, note, fees, and selected coins and restores ordinary send', async () => {
    renderSend();
    await setAmountAndFee();
    fireEvent.input(screen.getByRole('textbox', { name: /Note/ }), { target: { value: 'Keep note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select coin' }));
    await selectLightning();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const recipient = screen.getByRole('textbox', { name: 'Receiver address' });
    expect(recipient).not.toHaveAttribute('readonly');
    expect(recipient).toHaveValue('');
    expect(screen.getByText('Select account')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'sat' })).toHaveValue(10000);
    expect(screen.getByRole('textbox', { name: /Note/ })).toHaveValue('Keep note');
    expect(screen.getByRole('spinbutton', { name: /Fee rate/ })).toHaveValue(2);
    expect(screen.getByRole('checkbox', { name: 'Send selected coins' })).not.toBeChecked();
    fireEvent.input(recipient, { target: { value: 'bc1qordinary' } });
    await waitFor(() => expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({
      address: 'bc1qordinary', amount: '10000', customFee: '2', selectedUTXOs: ['txid:1'], sendAll: 'no',
    })));
  });

  it('switches between Lightning and Bitcoin accounts without resetting the form', async () => {
    renderSend(account, true, true, [account]);
    await setAmountAndFee();
    fireEvent.click(screen.getByRole('button', { name: 'Select coin' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send selected coins' }));
    await selectLightning();
    await waitFor(() => expect(lightningApi.postPrepareTopUp).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByText('Lightning'));
    fireEvent.click(await screen.findByRole('option', { name: /Bitcoin Account/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qordinary'));
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveAttribute('readonly');
    expect(screen.getByRole('checkbox', { name: 'Send selected coins' })).toBeChecked();
    await waitFor(() => expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({
      address: 'bc1qordinary', amount: '10000', customFee: '2', selectedUTXOs: ['txid:1'], sendAll: 'yes',
    })));

    vi.mocked(lightningApi.postPrepareTopUp).mockClear();
    fireEvent.mouseDown(screen.getByText('Bitcoin Account'));
    fireEvent.click(await screen.findByRole('option', { name: /Lightning/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
    await waitFor(() => expect(lightningApi.postPrepareTopUp).toHaveBeenCalledWith(expect.objectContaining({
      expectedAddress: 'bc1qboarding', amount: '10000', customFee: '2', selectedUTXOs: ['txid:1'], sendAll: 'yes',
    })));
    expect(screen.getAllByRole('button', { name: 'Reset' })).toHaveLength(1);
  });

  it('ignores a pending Bitcoin receive address after switching to Lightning', async () => {
    let resolve!: (addresses: NonEmptyArray<accountApi.TReceiveAddressList>) => void;
    vi.mocked(accountApi.getReceiveAddressList).mockReturnValue(() => new Promise(done => {
      resolve = done;
    }));
    renderSend(account, true, true, [account]);
    await setAmountAndFee();
    fireEvent.mouseDown(screen.getByText('Select account'));
    fireEvent.click(await screen.findByRole('option', { name: /Bitcoin Account/ }));
    await waitFor(() => expect(accountApi.getReceiveAddressList).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByText('Bitcoin Account'));
    fireEvent.click(await screen.findByRole('option', { name: /Lightning/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
    await act(async () => {
      resolve([{ scriptType: null, addresses: [{ addressID: '0', address: 'bc1qordinary', displayAddress: 'bc1qordinary' }] }]);
    });
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding');
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
  });

  it.each(['failure', 'empty'] as const)('clears Lightning when ordinary account lookup returns $0', async outcome => {
    const lookup = vi.fn<ReturnType<typeof accountApi.getReceiveAddressList>>();
    if (outcome === 'failure') {
      lookup.mockRejectedValue(new Error('Address unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
    } else {
      lookup.mockResolvedValue(null);
    }
    vi.mocked(accountApi.getReceiveAddressList).mockReturnValue(lookup);
    renderSend(account, true, true, [account]);
    await setAmountAndFee();
    await selectLightning();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled());

    fireEvent.mouseDown(screen.getByText('Lightning'));
    fireEvent.click(await screen.findByRole('option', { name: /Bitcoin Account/ }));
    await waitFor(() => expect(lookup).toHaveBeenCalled());
    expect(screen.getByText('Bitcoin Account')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
  });

  it.each([
    { success: false as const, errorCode: TLightningErrorCode.AMOUNT_BELOW_MINIMUM, minAmountSat: 1000 },
    { success: false as const, errorCode: 'lightningBalanceLimitExceeded' as const, fundingLimit: { limitSat: 200000, marginSat: 50000 } },
  ] satisfies lightningApi.TPrepareTopUpResult[])('blocks review on $errorCode', async result => {
    vi.mocked(lightningApi.postPrepareTopUp).mockResolvedValue(result);
    renderSend();
    await setAmountAndFee();
    await selectLightning();
    await screen.findAllByText(/The amount must be at least 1000 sats.|Maximum top-up amount/);
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
  });

  it('ignores a completed Lightning proposal after Reset', async () => {
    let resolve!: (result: lightningApi.TPrepareTopUpResult) => void;
    vi.mocked(lightningApi.postPrepareTopUp).mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    renderSend();
    await setAmountAndFee();
    await selectLightning();
    await waitFor(() => expect(lightningApi.postPrepareTopUp).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => {
      resolve(proposal);
    });
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  it.each([false, true])('finishes an older Lightning preparation before proposing an ordinary recipient (remount: %s)', async remount => {
    let resolve!: (result: lightningApi.TPrepareTopUpResult) => void;
    vi.mocked(lightningApi.postPrepareTopUp).mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    const view = renderSend();
    await setAmountAndFee();
    await selectLightning();
    await waitFor(() => expect(lightningApi.postPrepareTopUp).toHaveBeenCalled());
    if (remount) {
      view.unmount();
      renderSend();
      await setAmountAndFee();
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    }
    fireEvent.input(screen.getByRole('textbox', { name: 'Receiver address' }), { target: { value: 'bc1qordinary' } });
    await act(async () => {
      await new Promise(done => setTimeout(done, 450));
    });
    try {
      expect(accountApi.proposeTx).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    } finally {
      await act(async () => {
        resolve(proposal);
      });
    }
    await waitFor(() => expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({
      address: 'bc1qordinary',
    })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled());
  });

  it.each(['Lightning', 'ordinary'] as const)('ends loading when a %s proposal times out and ignores its late result', async recipient => {
    let resolve!: (result: Extract<accountApi.TTxProposalResult, { success: true }>) => void;
    const pending = new Promise<Extract<accountApi.TTxProposalResult, { success: true }>>(done => {
      resolve = done;
    });
    const propose = (
      recipient === 'Lightning'
        ? vi.mocked(lightningApi.postPrepareTopUp)
        : vi.mocked(accountApi.proposeTx)
    );
    propose.mockReturnValue(pending);
    vi.mocked(i18n.t).mockReturnValue('Proposal request expired');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSend();
    await setAmountAndFee();
    if (recipient === 'Lightning') {
      await selectLightning();
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
    } else {
      fireEvent.input(screen.getByRole('textbox', { name: 'Receiver address' }), { target: { value: 'bc1qordinary' } });
    }
    vi.useFakeTimers();
    try {
      fireEvent.input(screen.getByRole('spinbutton', { name: 'sat' }), { target: { value: '11000' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(propose).toHaveBeenCalled();
      expect(screen.getByText(/Calculating/)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByText('Proposal request expired')).toBeInTheDocument();
      expect(screen.queryByText(/Calculating/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    } finally {
      await act(async () => {
        resolve(proposal);
      });
      vi.useRealTimers();
    }
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  it('shows address errors with Retry and keeps recipient locked', async () => {
    vi.mocked(lightningApi.getBoardingAddress).mockRejectedValueOnce(new Error('Address unavailable'));
    renderSend();
    await screen.findByRole('spinbutton', { name: /Fee rate/ });
    await selectLightning();
    await screen.findByText(/Address unavailable/);
    expect(screen.getByRole('textbox', { name: /Receiver address/ })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
  });

  it('keeps the mobile account selector enabled after selecting Lightning', async () => {
    vi.spyOn(mediaQuery, 'useMediaQuery').mockReturnValue(true);
    renderSend(account, true, true, [account]);
    const selector = screen.getByRole('button', { name: 'Send to account' });
    fireEvent.click(selector);
    fireEvent.click(await screen.findByRole('button', { name: /Lightning/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('bc1qboarding'));
    expect(selector).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(selector).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Receiver address' })).toHaveValue('');
  });

  it.each([
    { coinCode: 'tbtc' as const, enabled: true, ready: true, visible: false },
    { coinCode: 'ltc' as const, enabled: true, ready: true, visible: false },
    { coinCode: 'btc' as const, enabled: false, ready: true, visible: false },
    { coinCode: 'btc' as const, enabled: true, ready: false, visible: true },
  ])('gates Lightning option for $coinCode enabled=$enabled ready=$ready', async ({ coinCode, enabled, ready, visible }) => {
    const source = { ...account, coinCode };
    renderSend(source, ready, enabled, [source]);
    await screen.findByRole('spinbutton', { name: /Fee rate/ });
    fireEvent.mouseDown(screen.getByText('Select account'));
    const lightningOption = screen.queryByRole('option', { name: /Lightning/ });
    if (visible) {
      expect(lightningOption).toHaveAttribute('aria-disabled', 'true');
    } else {
      expect(lightningOption).not.toBeInTheDocument();
    }
    expect(lightningApi.getBoardingAddress).not.toHaveBeenCalled();
  });
});
