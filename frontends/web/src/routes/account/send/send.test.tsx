// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../__mocks__/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { convertToCurrency } from '@/api/coins';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import en from '@/locales/en/app.json';
import { Send } from './send';

vi.mock('@/api/account');
vi.mock('@/api/coins');
vi.mock('@/api/accountsync', () => ({ syncdone: vi.fn(() => vi.fn()) }));
vi.mock('@/i18n/i18n');
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

const renderSend = async (sendAll = false) => {
  render(
    <MemoryRouter>
      <BackButtonProvider>
        <Send account={account} />
      </BackButtonProvider>
    </MemoryRouter>
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  fireEvent.input(screen.getByLabelText('Receiver address'), { target: { value: 'bc1qrecipient' } });
  if (sendAll) {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send all' }));
  } else {
    fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '0.001' } });
  }
  await advanceProposal();
};

describe('send high fee warning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    i18n.addResourceBundle('en', 'translation', en);
    vi.mocked(accountApi.getBalance).mockResolvedValue({ success: false });
    vi.mocked(accountApi.getFeeTargetList).mockResolvedValue({
      defaultFeeTarget: 'normal',
      feeTargets: [{ code: 'normal', feeRateInfo: '1 sat/vB' }],
    });
    vi.mocked(accountApi.proposeTx).mockReset().mockResolvedValue(proposal);
    vi.mocked(convertToCurrency).mockResolvedValue({ success: true, fiatAmount: '1' });
  });

  afterEach(() => {
    vi.useRealTimers();
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
