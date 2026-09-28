// SPDX-License-Identifier: Apache-2.0

import { alertUser } from '@/components/alert/Alert';
import { i18n } from '@/i18n/i18n';
import type { AccountCode } from '@/api/account';

// Account proposals replace the backend transaction for signing, so serialization must survive
// Send unmounts. A timed-out transport may still finish in the backend: fail subsequent attempts
// promptly until it settles instead of allowing it to overwrite a newer proposal.
const proposalQueues = new Map<AccountCode, Promise<void>>();
const timedOutAccounts = new Set<AccountCode>();

export const queueTxProposal = <T>(accountCode: AccountCode, propose: () => Promise<T> | T): Promise<T> => {
  const result = (proposalQueues.get(accountCode) ?? Promise.resolve()).then(() => {
    if (timedOutAccounts.has(accountCode)) {
      throw new Error(i18n.t('genericError'));
    }
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        timedOutAccounts.add(accountCode);
        reject(new Error(i18n.t('genericError')));
      }, 30_000);
      const finish = () => {
        clearTimeout(timeout);
        timedOutAccounts.delete(accountCode);
      };
      Promise.resolve().then(propose).then(value => {
        finish();
        resolve(value);
      }, error => {
        finish();
        reject(error);
      });
    });
  });
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
