// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { i18n as interfacei18n } from 'i18next';
import { txProposalErrorHandling } from './services';
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
  ...vi.importActual('@/components/alert/Alert'),
  alertUser: vi.fn()
}));

describe('send services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('returns rbf fee too low message on rbfFeeTooLow error', () => {
      const result = txProposalErrorHandling('rbfFeeTooLow');
      expect(result).toEqual({ feeError: 'send.error.rbfFeeTooLow' });
    });

    it('returns fees not available message on feesNotAvailable error', () => {
      const result = txProposalErrorHandling('feesNotAvailable');
      expect(result).toEqual({ feeError: 'send.error.feesNotAvailable' });
    });

    it('returns no field errors on rbfTxNotFound', () => {
      const result = txProposalErrorHandling('rbfTxNotFound');
      expect(result).toEqual({});
      expect(alertUser).not.toHaveBeenCalled();
    });

    it('returns no field errors on rbfTxAlreadyConfirmed', () => {
      const result = txProposalErrorHandling('rbfTxAlreadyConfirmed');
      expect(result).toEqual({});
      expect(alertUser).not.toHaveBeenCalled();
    });

    it('returns no field errors on rbfTxNotReplaceable', () => {
      const result = txProposalErrorHandling('rbfTxNotReplaceable');
      expect(result).toEqual({});
      expect(alertUser).not.toHaveBeenCalled();
    });

    it('alerts user on rbfInvalidTxID', () => {
      const result = txProposalErrorHandling('rbfInvalidTxID');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('send.error.rbfInvalidTxID');
    });

    it('alerts user on rbfCoinControlNotAllowed', () => {
      const result = txProposalErrorHandling('rbfCoinControlNotAllowed');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('send.error.rbfCoinControlNotAllowed');
    });

    it('returns proposed fee undefined and alerts the user when error is unknown', () => {
      const result = txProposalErrorHandling('unknownError');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('unknownError');
    });

  });
});
