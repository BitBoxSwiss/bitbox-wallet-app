// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { i18n as interfacei18n } from 'i18next';
import { handleSendError } from './services';
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
  describe('handleSendError', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns invalid address message on invalidAddress error', () => {
      const result = handleSendError('invalidAddress');
      expect(result).toEqual({ addressError: 'send.error.invalidAddress' });
    });

    it('returns invalid amount message on invalidAmount error', () => {
      const result = handleSendError('invalidAmount');
      expect(result).toEqual({ amountError: 'send.error.invalidAmount', proposedFee: undefined });
    });

    it('returns insufficient funds message on insufficientFunds error', () => {
      const result = handleSendError('insufficientFunds');
      expect(result).toEqual({ amountError: 'send.error.insufficientFunds', proposedFee: undefined });
    });

    it('returns fee too low message on feeTooLow error', () => {
      const result = handleSendError('feeTooLow');
      expect(result).toEqual({ feeError: 'send.error.feeTooLow' });
    });

    it('returns fees not available message on feesNotAvailable error', () => {
      const result = handleSendError('feesNotAvailable');
      expect(result).toEqual({ feeError: 'send.error.feesNotAvailable' });
    });

    it('alerts the user with the backend error message', () => {
      const result = handleSendError(undefined, 'Failed to create transaction proposal');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('Failed to create transaction proposal');
    });

    it('does not interpret an error message as a validation code', () => {
      const result = handleSendError(undefined, 'invalidAddress');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('invalidAddress');
    });

    it('uses the translated validation error when a backend message is also provided', () => {
      const result = handleSendError('invalidAddress', 'Backend error details');
      expect(result).toEqual({ addressError: 'send.error.invalidAddress' });
      expect(alertUser).not.toHaveBeenCalled();
    });

    it('falls back to the error code when no message is provided', () => {
      const result = handleSendError('accountNotSynced');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('accountNotSynced');
    });

    it('prefers the backend message for an unhandled error code', () => {
      const result = handleSendError('accountNotSynced', 'Account is not synced');
      expect(result).toEqual({});
      expect(alertUser).toHaveBeenCalledWith('Account is not synced');
    });

  });
});
