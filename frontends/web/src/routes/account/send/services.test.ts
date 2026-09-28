// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, it, expect, vi } from 'vitest';
import { i18n as interfacei18n } from 'i18next';
import { queueTxProposal, txProposalErrorHandling } from './services';
import { alertUser } from '@/components/alert/Alert';

vi.mock('i18next', async () => {
  const actualI18next: { default: interfacei18n } = await vi.importActual('i18next') as { default: interfacei18n };
  return {
    default: {
      ...actualI18next.default,
      use: vi.fn().mockReturnThis(),
      init: vi.fn(),
      addResourceBundle: vi.fn(),
      on: vi.fn(),
      t: vi.fn().mockImplementation((key: string) => key)
    },
  };
});

vi.mock('@/components/alert/Alert', () => ({
  alertUser: vi.fn()
}));

describe('send services', () => {
  describe('queueTxProposal', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(['resolve', 'reject'] as const)('fails promptly after timeout until the transport settles with %s', async outcome => {
      vi.useFakeTimers();
      let resolve!: (value: string) => void;
      let reject!: (error: Error) => void;
      const pending = new Promise<string>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      const first = queueTxProposal('btc', () => pending);
      const nextRequest = vi.fn(() => 'next');
      const next = queueTxProposal('btc', nextRequest);
      const firstError = expect(first).rejects.toThrow('genericError');
      const nextError = expect(next).rejects.toThrow('genericError');
      await vi.advanceTimersByTimeAsync(30_000);
      await firstError;
      await nextError;
      expect(nextRequest).not.toHaveBeenCalled();

      // A remounted caller must also fail without dispatching another backend proposal.
      await expect(queueTxProposal('btc', nextRequest)).rejects.toThrow('genericError');
      expect(nextRequest).not.toHaveBeenCalled();
      await expect(queueTxProposal('other-account', () => 'other')).resolves.toBe('other');

      if (outcome === 'resolve') {
        resolve('old');
      } else {
        reject(new Error('Transport failed'));
      }
      await vi.advanceTimersByTimeAsync(0);
      await expect(queueTxProposal('btc', nextRequest)).resolves.toBe('next');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('continues after a rejected request', async () => {
      const first = queueTxProposal('btc', () => Promise.reject(new Error('Transport failed')));
      const next = queueTxProposal('btc', () => 'next');
      await expect(first).rejects.toThrow('Transport failed');
      await expect(next).resolves.toBe('next');
    });
  });

  describe('txProposalErrorHandling', () => {

    it('returns invalid address message on invalidAddress error', () => {
      const result = txProposalErrorHandling('invalidAddress');
      expect(result).toEqual({ addressError: 'send.error.invalidAddress' });
    });

    it('returns invalid amount message on invalidAmount error', () => {
      const result = txProposalErrorHandling('invalidAmount');
      expect(result).toEqual({ amountError: 'send.error.invalidAmount', proposedFee: undefined });
    });

    it('returns insufficient funds message on insufficientFunds error', () => {
      const result = txProposalErrorHandling('insufficientFunds');
      expect(result).toEqual({ amountError: 'send.error.insufficientFunds', proposedFee: undefined });
    });

    it('returns fee too low message on feeTooLow error', () => {
      const result = txProposalErrorHandling('feeTooLow');
      expect(result).toEqual({ feeError: 'send.error.feeTooLow' });
    });

    it('returns fees not available message on feesNotAvailable error', () => {
      const result = txProposalErrorHandling('feesNotAvailable');
      expect(result).toEqual({ feeError: 'send.error.feesNotAvailable' });
    });

    it('returns proposed fee undefined and alerts the user when error is unknown', () => {
      const result = txProposalErrorHandling('unknownError');
      expect(result).toEqual({ proposedFee: undefined });
      expect(alertUser).toHaveBeenCalledWith('unknownError');
    });

  });
});
