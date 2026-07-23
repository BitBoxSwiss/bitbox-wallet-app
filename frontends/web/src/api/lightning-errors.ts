// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';

export enum TLightningErrorCode {
  PAYMENT_APPROVAL_REQUIRED = 'paymentApprovalRequired',
  AMOUNT_BELOW_MINIMUM = 'lightningAmountBelowMinimum',
  INVALID_AMOUNT = 'lightningInvalidAmount',
  INVALID_PAYMENT_INPUT = 'lightningInvalidPaymentInput',
  INSUFFICIENT_FUNDS = 'lightningInsufficientFunds',
  INVOICE_ALREADY_USED = 'lightningInvoiceAlreadyUsed',
  ADDRESS_CHANGE_COOLDOWN = 'lightningAddressChangeCooldown',
  ADDRESS_INVALID_USERNAME = 'lightningAddressInvalidUsername',
  ADDRESS_USERNAME_UNAVAILABLE = 'lightningAddressUsernameUnavailable',
}

// Backend error codes arrive over JSON, so keep the lookup defensive for unknown runtime values.
const lightningErrorTranslationKeys: Partial<Record<string, string>> = {
  [TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED]: 'error.paymentApprovalRequired',
  [TLightningErrorCode.AMOUNT_BELOW_MINIMUM]: 'error.lightningAmountBelowMinimum',
  [TLightningErrorCode.INVALID_AMOUNT]: 'error.lightningInvalidAmount',
  [TLightningErrorCode.INVALID_PAYMENT_INPUT]: 'error.lightningInvalidPaymentInput',
  [TLightningErrorCode.INSUFFICIENT_FUNDS]: 'error.lightningInsufficientFunds',
  [TLightningErrorCode.INVOICE_ALREADY_USED]: 'error.lightningInvoiceAlreadyUsed',
  [TLightningErrorCode.ADDRESS_CHANGE_COOLDOWN]: 'error.lightningAddressChangeCooldown',
  [TLightningErrorCode.ADDRESS_INVALID_USERNAME]: 'error.lightningAddressInvalidUsername',
  [TLightningErrorCode.ADDRESS_USERNAME_UNAVAILABLE]: 'error.lightningAddressUsernameUnavailable',
};

export type TLightningErrorData = {
  minAmountSat?: number;
};

export class TSdkError extends Error {
  code?: TLightningErrorCode;
  data?: TLightningErrorData;

  constructor(message: string, code?: TLightningErrorCode, data?: TLightningErrorData) {
    super(message);
    this.code = code;
    this.data = data;

    Object.setPrototypeOf(this, TSdkError.prototype);
  }
}

export const toLightningErrorMessage = (t: TFunction, error: unknown): string => {
  if (error instanceof TSdkError) {
    if (error.code) {
      const translationKey = lightningErrorTranslationKeys[error.code];
      if (translationKey) {
        return error.data ? t(translationKey, error.data) : t(translationKey);
      }
    }
    return error.message;
  }
  return String(error);
};
