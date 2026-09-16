// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, it, expect, vi } from 'vitest';
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
    // A slow preparation must finish before another caller replaces the same account's proposal.
    it.each(['resolve', 'reject'])('preserves request order when the previous request %ss', async outcome => {
      let finish!: () => void;
      const pending = new Promise<string>((resolve, reject) => {
        finish = () => outcome === 'resolve' ? resolve('first') : reject(new Error('Failed'));
      });
      const first = queueTxProposal('btc', () => pending);
      const firstResult = (
        outcome === 'resolve'
          ? expect(first).resolves.toBe('first')
          : expect(first).rejects.toThrow('Failed')
      );
      const propose = vi.fn(() => 'next');
      const next = queueTxProposal('btc', propose);

      await expect(queueTxProposal('other-account', () => 'other')).resolves.toBe('other');
      expect(propose).not.toHaveBeenCalled();
      finish();
      await firstResult;
      await expect(next).resolves.toBe('next');
    });
  });

  describe('txProposalErrorHandling', () => {
    beforeEach(() => vi.clearAllMocks());

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

    it('alerts the user with the backend error message', () => {
      const result = txProposalErrorHandling(undefined, 'Failed to create transaction proposal');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('Failed to create transaction proposal');
    });

    it('does not interpret an error message as a validation code', () => {
      const result = txProposalErrorHandling(undefined, 'invalidAddress');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('invalidAddress');
    });

    it('uses the translated validation error when a backend message is also provided', () => {
      const result = txProposalErrorHandling('invalidAddress', 'Backend error details');
      expect(result).toEqual({ addressError: 'send.error.invalidAddress' });
      expect(alertUser).not.toHaveBeenCalled();
    });

    it('falls back to the error code when no message is provided', () => {
      const result = txProposalErrorHandling('accountNotSynced');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('accountNotSynced');
    });

    it('prefers the backend message for an unhandled error code', () => {
      const result = txProposalErrorHandling('accountNotSynced', 'Account is not synced');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('Account is not synced');
    });

  });
});
