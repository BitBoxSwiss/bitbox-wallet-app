// SPDX-License-Identifier: Apache-2.0

import { alertUser } from '@/components/alert/Alert';
import type { AccountCode, TTxProposalErrorCode } from '@/api/account';
import { i18n } from '@/i18n/i18n';

// Bitcoin and Lightning proposals replace the same transaction for signing. Keep their order
// across Send unmounts so a slow Lightning preparation cannot overwrite a newer recipient.
const proposalQueues = new Map<AccountCode, Promise<void>>();

export const queueTxProposal = <T>(accountCode: AccountCode, propose: () => Promise<T> | T): Promise<T> => {
  const result = (proposalQueues.get(accountCode) ?? Promise.resolve()).then(propose);
  const tail = result.then(() => {}, () => {});
  proposalQueues.set(accountCode, tail);
  tail.then(() => {
    if (proposalQueues.get(accountCode) === tail) {
      proposalQueues.delete(accountCode);
    }
  });
  return result;
};

export type TProposalError = {
  addressError?: string;
  amountError?: string;
  feeError?: string;
};

export const txProposalErrorHandling = (
  errorCode?: TTxProposalErrorCode,
  errorMessage?: string,
): TProposalError => {
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
  default: {
    const message = errorMessage || errorCode;
    if (message) {
      alertUser(message);
    }
    return {};
  }
  }
};
