// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from '@/utils/test-helpers';
import * as accountApi from '@/api/account';
import { convertFromCurrency, convertToCurrency } from '@/api/coins';
import { useQRScanner } from '@/hooks/qrcodescanner';
import { alertUser } from '@/components/alert/Alert';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { RatesContext } from '@/contexts/RatesContext';
import en from '@/locales/en/app.json';
import { Send } from './send';

vi.mock('@/api/account');
vi.mock('@/api/coins');
vi.mock('@/hooks/qrcodescanner');
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));
vi.mock('@/api/accountsync', () => ({ syncdone: vi.fn(() => vi.fn()) }));
vi.mock('@/i18n/i18n', async () => ({
  i18n: (await import('../../../../__mocks__/i18n')).default,
}));
vi.mock('@/contexts/ConfigProvider', () => {
  const config = { frontend: { expertFee: true } };
  return { useConfig: () => ({ config }) };
});
vi.mock('./send-guide', () => ({ SendGuide: () => null }));

const account: accountApi.TAccount = {
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  name: 'Bitcoin Account',
};

const proposal: Extract<accountApi.TTxProposalResult, { success: true }> = {
  success: true,
  amount: { amount: '0.001', unit: 'BTC', conversions: {}, estimated: false },
  fee: { amount: '0.0001', unit: 'BTC', conversions: {}, estimated: false },
  total: { amount: '0.0011', unit: 'BTC', conversions: {}, estimated: false },
  recipientDisplayAddress: 'bc1qrecipient',
  highFeePercentage: '10.0',
};

const advanceProposal = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
};

const scan = async (input: string) => {
  fireEvent.click(screen.getByRole('button', { name: '' }));
  const scannerOptions = vi.mocked(useQRScanner).mock.lastCall?.[1];
  if (!scannerOptions) {
    throw new Error('Missing QR scanner');
  }
  await act(async () => {
    scannerOptions.onResult({ data: input, cornerPoints: [] });
  });
};

const renderEmptySend = async (sendAccount = account) => {
  render(
    <MemoryRouter>
      <BackButtonProvider>
        <RatesContext.Provider value={{
          defaultCurrency: 'USD',
          activeCurrencies: ['USD'],
          rotateDefaultCurrency: vi.fn(),
          rotateBtcUnit: vi.fn(),
          addToActiveCurrencies: vi.fn(),
          updateDefaultCurrency: vi.fn(),
          removeFromActiveCurrencies: vi.fn(),
        }}>
          <Send account={sendAccount} />
        </RatesContext.Provider>
      </BackButtonProvider>
    </MemoryRouter>
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

const renderSend = async (sendAll = false) => {
  await renderEmptySend();
  fireEvent.input(screen.getByLabelText('Receiver address'), { target: { value: 'bc1qrecipient' } });
  if (sendAll) {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send all' }));
  } else {
    fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.001' } });
  }
  await advanceProposal();
};

describe('send', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    i18n.addResourceBundle('en', 'translation', en);
    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: false });
    vi.mocked(accountApi.getFeeTargetList).mockResolvedValue({
      defaultFeeTarget: 'normal',
      feeTargets: [{ code: 'normal', feeRateInfo: '1 sat/vB' }],
    });
    vi.mocked(accountApi.parsePaymentInput).mockReset();
    vi.mocked(useQRScanner).mockReturnValue({
      initErrorMessage: undefined,
      hasFlash: false,
      isFlashOn: false,
      toggleFlash: vi.fn(),
    });
    vi.mocked(accountApi.proposeTx).mockReset().mockResolvedValue(proposal);
    vi.mocked(convertToCurrency).mockResolvedValue({ success: true, fiatAmount: '1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Invalid scans show an editable address and inline error before an amount is entered.
  // Editing another field must not hide the error or allow a proposal until the address is corrected.
  it.each(['btc', 'eth'] as const)('shows an invalid scanned %s address inline', async coinCode => {
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({
      success: true, validationError: 'invalidAddress', recipient: 'invalid-address',
    });
    await renderEmptySend({ ...account, coinCode });
    await scan('invalid-address');
    await advanceProposal();

    expect(accountApi.parsePaymentInput).toHaveBeenCalledWith(account.code, 'invalid-address');
    expect(alertUser).not.toHaveBeenCalled();
    expect(screen.getByText(en.send.error.invalidAddress)).toBeVisible();
    expect(screen.getByLabelText(/^Receiver address/)).toHaveValue('invalid-address');
    expect(screen.getByLabelText('Amount')).toHaveValue(null);
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.001' } });
    await advanceProposal();
    expect(screen.getByText(en.send.error.invalidAddress)).toBeVisible();
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();

    fireEvent.input(screen.getByLabelText(/^Receiver address/), { target: { value: 'corrected-address' } });
    await advanceProposal();
    expect(screen.queryByText(en.send.error.invalidAddress)).not.toBeInTheDocument();
    expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({ address: 'corrected-address' }));
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
  });

  // The frontend applies backend values, including BTC converted to satoshis and an explicit zero.
  it.each([
    { coinCode: 'btc', input: 'bc1qrecipient', amount: undefined },
    { coinCode: 'btc', input: 'bitcoin:bc1qrecipient?amount=0.001', amount: '100000' },
    { coinCode: 'btc', input: 'bitcoin:bc1qrecipient?amount=0', amount: '0' },
    { coinCode: 'eth', input: 'ethereum:0xrecipient?value=1e18', amount: '1' },
  ] as const)('populates a validated $coinCode scan: $input', async ({ coinCode, input, amount }) => {
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({ success: true, recipient: 'validated-recipient', amount });
    await renderEmptySend({ ...account, coinCode });
    await scan(input);

    expect(accountApi.parsePaymentInput).toHaveBeenCalledWith(account.code, input);
    expect(screen.getByLabelText('Receiver address')).toHaveValue('validated-recipient');
    expect(screen.getByLabelText('Amount')).toHaveValue(amount === undefined ? null : Number(amount));
    expect(alertUser).not.toHaveBeenCalled();
    if (amount === undefined) {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(en.send.feeTarget.placeholder)).not.toBeInTheDocument();
      await advanceProposal();
      expect(accountApi.proposeTx).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    } else {
      expect(convertToCurrency).toHaveBeenCalledWith(expect.objectContaining({ amount }));
      await advanceProposal();
      expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({
        address: 'validated-recipient', amount,
      }));
    }
  });

  // A rejected payment request must preserve the recipient and amount already entered by the user.
  it.each([
    { errorCode: 'accountMismatch', message: en.send.error.paymentRequestAccountMismatch },
    { errorCode: 'invalidFormat', message: en.invalidFormat },
  ] as const)('preserves the form when scanning fails with $errorCode', async ({ errorCode, message }) => {
    await renderSend();
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({ success: false, errorCode });
    await scan('invalid-payment-input');

    expect(alertUser).toHaveBeenCalledWith(message);
    expect(screen.getByLabelText('Receiver address')).toHaveValue('bc1qrecipient');
    expect(screen.getByLabelText('Amount')).toHaveValue(0.001);
  });

  // An unrepresentable URI amount clears the old amount and stays inline until the user replaces it.
  it.each(['coin', 'fiat', 'sendAll'])('corrects an invalid scanned amount via %s', async correction => {
    await renderSend();
    vi.mocked(accountApi.proposeTx).mockClear();
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({
      success: true, validationError: 'invalidAmount', recipient: 'scanned-recipient', amount: '',
    });
    await scan('bitcoin:scanned-recipient?amount=invalid');
    await advanceProposal();

    expect(alertUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Receiver address')).toHaveValue('scanned-recipient');
    expect(screen.getByLabelText(/^Amount/)).toHaveValue(null);
    expect(screen.getByLabelText(/^Amount/)).toHaveAccessibleName(`Amount: ${en.send.error.invalidAmount}`);
    expect(accountApi.proposeTx).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Receiver address'), { target: { value: 'another-recipient' } });
    await advanceProposal();
    expect(screen.getByLabelText(/^Amount/)).toHaveAccessibleName(`Amount: ${en.send.error.invalidAmount}`);

    if (correction === 'sendAll') {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Send all' }));
    } else if (correction === 'fiat') {
      vi.mocked(convertFromCurrency).mockResolvedValue({ success: true, amount: '0.002' });
      await act(async () => {
        fireEvent.input(screen.getByLabelText(/^USD/), { target: { value: '2' } });
      });
    } else {
      fireEvent.input(screen.getByLabelText(/^Amount/), { target: { value: '0.002' } });
    }
    await advanceProposal();
    await advanceProposal();
    expect(screen.queryByText(en.send.error.invalidAmount)).not.toBeInTheDocument();
    expect(accountApi.proposeTx).toHaveBeenCalledWith(account.code, expect.objectContaining({
      address: 'another-recipient', sendAll: correction === 'sendAll' ? 'yes' : 'no',
      amount: correction === 'sendAll' ? '' : '0.002',
    }));
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
  });

  // Clearing a scan error must reveal subsequent transaction errors on the same field.
  // The cleared scan entry must neither hide the proposal error nor prevent the proposal.
  it('shows transaction errors after correcting a scanned amount', async () => {
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({
      success: true, validationError: 'invalidAmount', recipient: 'scanned-recipient', amount: '',
    });
    vi.mocked(accountApi.proposeTx).mockResolvedValue({ success: false, errorCode: 'insufficientFunds' });
    await renderEmptySend();
    await scan('bitcoin:scanned-recipient?amount=invalid');
    expect(screen.getByLabelText(/^Amount/)).toHaveAccessibleName(`Amount: ${en.send.error.invalidAmount}`);

    await act(async () => {
      fireEvent.input(screen.getByLabelText(/^Amount/), { target: { value: '0.002' } });
    });
    await advanceProposal();
    await advanceProposal();
    expect(accountApi.proposeTx).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^Amount/)).toHaveAccessibleName(`Amount: ${en.send.error.insufficientFunds}`);
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(alertUser).not.toHaveBeenCalled();
  });

  // A stale proposal cannot clear a scan error or enable Review; a subsequent valid scan clears it.
  it('keeps scan errors while an older proposal resolves', async () => {
    let resolve: (result: accountApi.TTxProposalResult) => void = () => {};
    vi.mocked(accountApi.proposeTx).mockReturnValueOnce(new Promise(nextResolve => {
      resolve = nextResolve;
    }));
    await renderSend();
    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({
      success: true, validationError: 'invalidAddress', recipient: 'invalid-address', amount: '100000',
    });
    await scan('bitcoin:invalid-address?amount=0.001');
    await act(async () => {
      resolve(proposal);
    });
    await advanceProposal();

    expect(screen.getByLabelText(/^Receiver address/)).toHaveValue('invalid-address');
    expect(screen.getByLabelText('Amount')).toHaveValue(100000);
    expect(screen.getByText(en.send.error.invalidAddress)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(accountApi.proposeTx).toHaveBeenCalledTimes(1);
    expect(alertUser).not.toHaveBeenCalled();

    vi.mocked(accountApi.parsePaymentInput).mockResolvedValue({ success: true, recipient: 'valid-address' });
    await scan('valid-address');
    await advanceProposal();
    expect(screen.queryByText(en.send.error.invalidAddress)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
  });

  // The scanner waits for backend validation; a bare address preserves the existing amount.
  it('waits for the parser before accepting the scan', async () => {
    let resolve: (result: Awaited<ReturnType<typeof accountApi.parsePaymentInput>>) => void = () => {};
    vi.mocked(accountApi.parsePaymentInput).mockReturnValue(new Promise(nextResolve => {
      resolve = nextResolve;
    }));
    await renderSend();
    await scan('new-address');
    await advanceProposal();
    expect(screen.getByLabelText('Receiver address')).toHaveValue('bc1qrecipient');
    expect(screen.getByText(en.send.scanQRInstruction)).toBeInTheDocument();

    await act(async () => {
      resolve({ success: true, recipient: 'new-address' });
    });
    await advanceProposal();
    expect(screen.queryByText(en.send.scanQRInstruction)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Receiver address')).toHaveValue('new-address');
    expect(screen.getByLabelText('Amount')).toHaveValue(0.001);
  });

  // A cancelled scan cannot overwrite later edits or a newer scan, even if scanning is reopened.
  it.each(['edit', 'rescan'])('ignores a cancelled scan after %s', async correction => {
    let resolve: (result: Awaited<ReturnType<typeof accountApi.parsePaymentInput>>) => void = () => {};
    vi.mocked(accountApi.parsePaymentInput).mockReturnValueOnce(new Promise(nextResolve => {
      resolve = nextResolve;
    }));
    await renderSend();
    await scan('cancelled-recipient');
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    await advanceProposal();
    expect(screen.queryByText(en.send.scanQRInstruction)).not.toBeInTheDocument();

    if (correction === 'edit') {
      fireEvent.input(screen.getByLabelText('Receiver address'), { target: { value: 'new-recipient' } });
      fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.002' } });
    } else {
      vi.mocked(accountApi.parsePaymentInput).mockResolvedValueOnce({
        success: true, recipient: 'new-recipient', amount: '0.002',
      });
      await scan('new-recipient');
    }
    await act(async () => {
      resolve({ success: true, recipient: 'cancelled-recipient', amount: '0.5' });
    });
    await advanceProposal();

    expect(screen.getByLabelText('Receiver address')).toHaveValue('new-recipient');
    expect(screen.getByLabelText('Amount')).toHaveValue(0.002);
    expect(accountApi.proposeTx).toHaveBeenLastCalledWith(account.code, expect.objectContaining({
      address: 'new-recipient', amount: '0.002',
    }));
    expect(alertUser).not.toHaveBeenCalled();
  });

  // Cancellation takes effect before the closing animation ends, including parser failures.
  it.each(['invalidFormat', 'requestError'])('ignores %s while the scanner is closing', async error => {
    let settle = () => {};
    vi.mocked(accountApi.parsePaymentInput).mockReturnValueOnce(new Promise((resolve, reject) => {
      settle = () => error === 'requestError'
        ? reject(new Error('request failed'))
        : resolve({ success: false, errorCode: 'invalidFormat' });
    }));
    await renderSend();
    await scan('cancelled-input');
    act(() => {
      expect(window.onBackButtonPressed?.()).toBe(false);
    });
    await act(async () => {
      settle();
    });

    expect(alertUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Receiver address')).toHaveValue('bc1qrecipient');
    expect(screen.getByLabelText('Amount')).toHaveValue(0.001);
  });

  it.each([false, true])('warns before device confirmation (send all: %s)', async sendAll => {
    await renderSend(sendAll);
    await advanceProposal();

    expect(screen.getByText('High fee')).toBeVisible();
    expect(screen.getByText('Fee is 10.0% of the send amount. Proceed?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled();
    expect(accountApi.sendTx).not.toHaveBeenCalled();
    expect(accountApi.proposeTx).toHaveBeenLastCalledWith(account.code, expect.objectContaining({
      sendAll: sendAll ? 'yes' : 'no',
    }));
  });

  it.each([
    { ...proposal, highFeePercentage: undefined },
    { success: false, errorCode: 'invalidAmount' },
  ] satisfies accountApi.TTxProposalResult[])('clears warning while updating and after result %j', async result => {
    await renderSend();
    await advanceProposal();
    expect(screen.getByText('High fee')).toBeVisible();
    vi.mocked(accountApi.proposeTx).mockResolvedValue(result);

    fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.002' } });
    expect(screen.queryByText('High fee')).not.toBeInTheDocument();
    await advanceProposal();
    expect(screen.queryByText('High fee')).not.toBeInTheDocument();
  });

  it.each(['0.002', ''])('ignores stale warning after amount changes to %j', async amount => {
    let resolve: (result: accountApi.TTxProposalResult) => void = () => {};
    const pending = new Promise<accountApi.TTxProposalResult>(nextResolve => {
      resolve = nextResolve;
    });
    vi.mocked(accountApi.proposeTx).mockReturnValueOnce(pending);
    await renderSend();
    expect(accountApi.proposeTx).toHaveBeenCalledTimes(1);

    fireEvent.input(screen.getByLabelText('Amount'), { target: { value: amount } });
    await act(async () => {
      resolve(proposal);
      await pending;
    });

    expect(screen.queryByText('High fee')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(accountApi.proposeTx).toHaveBeenCalledTimes(1);
  });
});
