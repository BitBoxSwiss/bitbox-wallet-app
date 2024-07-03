import { describe, it, expect, vi } from 'vitest';
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
  describe('txProposalErrorHandling', () => {

    const mockRegisterEvents = vi.fn();
    const mockUnregisterEvents = vi.fn();

    it('returns invalid address message on invalidAddress error', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'invalidAddress');
      expect(result).toEqual({ addressError: 'send.error.invalidAddress' });
    });

    it('returns invalid amount message on invalidAmount error', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'invalidAmount');
      expect(result).toEqual({ amountError: 'send.error.invalidAmount', proposedFee: undefined });
    });

    it('returns insufficient funds message on insufficientFunds error', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'insufficientFunds');
      expect(result).toEqual({ amountError: 'send.error.insufficientFunds', proposedFee: undefined });
    });

    it('returns fee too low message on feeTooLow error', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'feeTooLow');
      expect(result).toEqual({ feeError: 'send.error.feeTooLow' });
    });

    it('returns fees not available message on feesNotAvailable error', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'feesNotAvailable');
      expect(result).toEqual({ feeError: 'send.error.feesNotAvailable' });
    });

    it('returns proposed fee undefined and alerts the user when error is unknown', () => {
      const result = txProposalErrorHandling(mockRegisterEvents, mockUnregisterEvents, 'unknownError');
      expect(result).toEqual({ proposedFee: undefined });
      expect(alertUser).toHaveBeenCalledWith('unknownError', { callback: mockRegisterEvents });
    });

  });
});
