// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '@/api/account';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode } from '@/api/lightning-errors';
import * as keystoresApi from '@/api/keystores';
import { convertToCurrency } from '@/api/coins';
import { useLightning } from '@/hooks/lightning';
import { useMediaQuery } from '@/hooks/mediaquery';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { MemoryRouter } from '@/utils/test-helpers';
import en from '@/locales/en/app.json';
import { Send } from './send';

const config = vi.hoisted(() => ({ frontend: { expertFee: true, coinControl: false } }));
vi.mock('@/api/account', async importOriginal => ({
  ...await importOriginal<typeof accountApi>(),
  getBalance: vi.fn(),
  getFeeTargetList: vi.fn(),
  getUTXOs: vi.fn(),
  proposeTx: vi.fn(),
  sendTx: vi.fn(),
}));
vi.mock('@/api/coins');
vi.mock('@/api/lightning');
vi.mock('@/api/keystores');
vi.mock('@/api/accountsync', () => ({ syncdone: vi.fn(() => vi.fn()) }));
vi.mock('@/hooks/lightning');
vi.mock('@/hooks/mediaquery');
vi.mock('@/i18n/i18n');
vi.mock('@/contexts/ConfigProvider', () => ({ useConfig: () => ({ config }) }));
vi.mock('./send-guide', () => ({ SendGuide: () => null }));
vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({ FirmwareUpgradeRequiredDialog: () => null }));

const account: accountApi.TAccount = {
  active: true, blockExplorerTxPrefix: '', code: 'btc-account', coinCode: 'btc',
  coinName: 'Bitcoin', coinUnit: 'BTC', isToken: false, name: 'Bitcoin Account',
  keystore: { connected: true, lastConnected: '', name: 'BitBox02', rootFingerprint: 'f23ab988', watchonly: false },
};
const amount = (value: string): accountApi.TAmountWithConversions => ({ amount: value, unit: 'BTC', conversions: {}, estimated: false });
const proposal: Extract<lightningApi.TPrepareTopUpResult, { success: true }> = {
  success: true, amount: amount('0.001'), fee: amount('0.0001'), total: amount('0.0011'),
  recipientDisplayAddress: 'bc1qboarding', estimatedClaimFee: amount('0.00001'),
};
const ready = {
  lightningAccount: { code: 'lightning', coinCode: 'lightning' as const, rootFingerprint: '1234', num: 0 },
  isLightningReady: true, lightningSDKStatus: 'ready' as const,
};

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const enterAmount = async () => {
  fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.001' } });
  await flush(400);
  await flush(400);
};
const renderSend = async (fixed = true) => {
  const onBack = vi.fn();
  const onDone = vi.fn();
  render(
    <MemoryRouter>
      <BackButtonProvider>
        <Send account={account} fixedRecipient={fixed ? 'lightning' : undefined} onBack={onBack} onDone={onDone} />
      </BackButtonProvider>
    </MemoryRouter>
  );
  await flush();
  return { onBack, onDone };
};

describe('Lightning top-up through Send', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    config.frontend.coinControl = false;
    i18n.addResourceBundle('en', 'translation', en);
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(useLightning).mockReturnValue(ready);
    vi.mocked(lightningApi.getBoardingAddress).mockResolvedValue('bc1qboarding');
    vi.mocked(lightningApi.postPrepareTopUp).mockResolvedValue(proposal);
    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: false });
    vi.mocked(accountApi.getFeeTargetList).mockResolvedValue({
      defaultFeeTarget: 'normal', feeTargets: [{ code: 'normal', feeRateInfo: '1 sat/vB' }],
    });
    vi.mocked(convertToCurrency).mockResolvedValue({ success: true, fiatAmount: '1' });
    vi.mocked(keystoresApi.connectKeystore).mockResolvedValue({ success: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Both layouts lock the destination, preserve the note, and use the explicit top-up Back target.
  it.each([false, true])('locks the Lightning recipient and wires Back (mobile: %s)', async mobile => {
    vi.mocked(useMediaQuery).mockReturnValue(mobile);
    const { onBack } = await renderSend();
    expect(screen.getByLabelText('Receiver address')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Receiver address')).toHaveValue('Lightning');
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Note/)).toHaveValue('Lightning top-up');
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[mobile ? 0 : 1]!);
    expect(onBack).toHaveBeenCalledOnce();
    await enterAmount();
    expect(lightningApi.postPrepareTopUp).toHaveBeenLastCalledWith({
      sourceAccountCode: account.code, amount: '0.001', sendAll: false, selectedUTXOs: [],
      feeTarget: 'normal', customFee: '', expectedAddress: 'bc1qboarding',
    });
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
  });

  // Both available and unavailable claim estimates permit the same signing and success flow.
  it.each([proposal.estimatedClaimFee, null])('shows claim fee %j and completes a top-up', async estimatedClaimFee => {
    vi.mocked(lightningApi.postPrepareTopUp).mockResolvedValue({ ...proposal, estimatedClaimFee });
    let complete!: (result: accountApi.TSendTx) => void;
    vi.mocked(accountApi.sendTx).mockReturnValue(new Promise(resolve => {
      complete = resolve;
    }));
    await renderSend();
    await enterAmount();
    expect(screen.getByText('Estimated claim fee')).toBeVisible();
    if (estimatedClaimFee === null) {
      expect(screen.getByText(/Unavailable/)).toBeVisible();
    }
    expect(accountApi.sendTx).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await flush();
    expect(accountApi.sendTx).toHaveBeenCalledWith(account.code, 'Lightning top-up');
    expect(screen.getByText('bc1qboarding')).toBeVisible();
    await act(async () => complete({ success: true, txId: 'tx-id' }));
    expect(screen.getByText('Top up created!')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(window.location.hash).toBe('#/lightning');
  });

  // Validation remains backend-owned and prevents Review for minimum and funding-limit failures.
  it.each([
    { result: { success: false, errorCode: TLightningErrorCode.AMOUNT_BELOW_MINIMUM, minAmountSat: 1000 }, message: /at least 1000 sats/ },
    { result: { success: false, errorCode: 'lightningBalanceLimitExceeded', fundingLimit: { limitSat: 200000, marginSat: 50000 } }, message: /Maximum top-up amount/ },
  ] satisfies { result: lightningApi.TPrepareTopUpResult; message: RegExp }[])('blocks invalid top-ups: $result.errorCode', async ({ result, message }) => {
    vi.mocked(lightningApi.postPrepareTopUp).mockResolvedValue(result);
    await renderSend();
    await enterAmount();
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(accountApi.sendTx).not.toHaveBeenCalled();
  });

  // A locked destination must still offer recovery when its address lookup fails.
  it('blocks Review on address failure and can retry without unlocking the recipient', async () => {
    vi.mocked(lightningApi.getBoardingAddress).mockRejectedValueOnce(new Error('Address unavailable'));
    await renderSend();
    await enterAmount();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(lightningApi.postPrepareTopUp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    await flush(400);
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
    expect(screen.getByLabelText('Receiver address')).toHaveAttribute('readonly');
  });

  // Aborting device confirmation keeps the shared form for editing and uses the caller's Done target.
  it('preserves the locked form after abort and sends Done back to Lightning', async () => {
    vi.mocked(accountApi.sendTx).mockResolvedValue({ success: false, aborted: true });
    const { onDone } = await renderSend();
    await enterAmount();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Edit transaction' }));
    expect(screen.getByLabelText('Amount')).toHaveValue(0.001);
    expect(screen.getByLabelText('Receiver address')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  // Ordinary Send still allows manually selecting Lightning and switching back to an external address.
  it('keeps ordinary Send editable and supports manual Lightning selection', async () => {
    vi.mocked(accountApi.proposeTx).mockResolvedValue(proposal);
    await renderSend(false);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]!);
    fireEvent.click(screen.getByRole('option', { name: /Lightning/ }));
    await enterAmount();
    expect(lightningApi.postPrepareTopUp).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.input(screen.getByLabelText('Receiver address'), { target: { value: 'bc1qexternal' } });
    await flush(400);
    await flush(400);
    expect(accountApi.proposeTx).toHaveBeenLastCalledWith(account.code, expect.objectContaining({ address: 'bc1qexternal' }));
  });

  // Send-all and coin control must reach the shared top-up proposal with their original backend contracts.
  it('passes send-all and selected UTXOs through the top-up proposal', async () => {
    config.frontend.coinControl = true;
    vi.mocked(accountApi.getUTXOs).mockResolvedValue({ success: true, utxos: [{
      outPoint: 'tx-id:0', address: 'bc1qsource', amount: amount('0.002'),
      scriptType: 'p2wpkh', addressReused: false, isChange: false,
      txId: 'tx-id', txOutput: 0, note: 'Selected coin', headerTimestamp: null,
    }] });
    await renderSend();
    fireEvent.click(screen.getByRole('button', { name: /coin control/i }));
    await flush();
    fireEvent.click(screen.getByRole('checkbox', { name: /Selected coin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send selected coins' }));
    await flush(800);
    expect(lightningApi.postPrepareTopUp).toHaveBeenLastCalledWith(expect.objectContaining({
      sendAll: true, selectedUTXOs: ['tx-id:0'], expectedAddress: 'bc1qboarding',
    }));
  });
});
