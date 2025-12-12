// SPDX-License-Identifier: Apache-2.0

import { alertUser } from '@/components/alert/Alert';
import { i18n } from '@/i18n/i18n';

export type TProposalError = {
  addressError?: string;
  amountError?: string;
  feeError?: string;
};

export const txProposalErrorHandling = (errorCode?: string): TProposalError => {
  const { t } = i18n;
  switch (errorCode) {
  case 'invalidAddress':
    return { addressError: t('send.error.invalidAddress') };
  case 'invalidAmount':
  case 'insufficientFunds':
    return { amountError: t(`send.error.${errorCode}`) };
  case 'feeTooLow':
  case 'feesNotAvailable':
    return { feeError: t(`send.error.${errorCode}`) };
  default:
    if (errorCode) {
      alertUser(errorCode);
    }
    return {};
  }
};
