// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';

export enum TLightningErrorCode {
  PAYMENT_APPROVAL_REQUIRED = 'paymentApprovalRequired',
  INVALID_AMOUNT = 'lightningInvalidAmount',
  INVALID_PAYMENT_INPUT = 'lightningInvalidPaymentInput',
  INSUFFICIENT_FUNDS = 'lightningInsufficientFunds',
  INVOICE_ALREADY_USED = 'lightningInvoiceAlreadyUsed',
}

// Backend error codes arrive over JSON, so keep the lookup defensive for unknown runtime values.
const lightningErrorTranslationKeys: Partial<Record<string, string>> = {
  [TLightningErrorCode.PAYMENT_APPROVAL_REQUIRED]: 'error.paymentApprovalRequired',
  [TLightningErrorCode.INVALID_AMOUNT]: 'error.lightningInvalidAmount',
  [TLightningErrorCode.INVALID_PAYMENT_INPUT]: 'error.lightningInvalidPaymentInput',
  [TLightningErrorCode.INSUFFICIENT_FUNDS]: 'error.lightningInsufficientFunds',
  [TLightningErrorCode.INVOICE_ALREADY_USED]: 'error.lightningInvoiceAlreadyUsed',
};

export class TSdkError extends Error {
  code?: TLightningErrorCode;

  constructor(message: string, code?: TLightningErrorCode) {
    super(message);
    this.code = code;

    Object.setPrototypeOf(this, TSdkError.prototype);
  }
}

export const toLightningErrorMessage = (t: TFunction, error: unknown): string => {
  if (error instanceof TSdkError) {
    if (error.code) {
      const translationKey = lightningErrorTranslationKeys[error.code];
      if (translationKey) {
        return t(translationKey);
      }
    }
    return error.message;
  }
  return String(error);
};
