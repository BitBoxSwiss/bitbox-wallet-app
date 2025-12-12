// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from './account';
import type { TUnsubscribe } from '@/utils/transport-common';
import type { NonEmptyArray } from '@/utils/types';
import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint } from './subscribe';

type TAccount = {
  name: string;
  code: AccountCode;
};

type Accounts = NonEmptyArray<TAccount>;

export type Aopp = {
  state: 'error';
  errorCode: 'aoppUnsupportedAsset' | 'aoppVersion' | 'aoppInvalidRequest' | 'aoppNoAccounts' | 'aoppUnsupportedKeystore' | 'aoppUnknown' | 'aoppSigningAborted' | 'aoppCallback';
  callback: string;
} | {
  state: 'inactive';
} | {
  state: 'user-approval' | 'awaiting-keystore' | 'syncing';
  message: string;
  callback: string;
  xpubRequired: boolean;
} | {
  state: 'choosing-account';
  accounts: Accounts;
  message: string;
  callback: string;
} | {
  state: 'signing' | 'success';
  address: string;
  addressID: string;
  message: string;
  callback: string;
  accountCode: AccountCode;
};

export const cancel = (): Promise<null> => {
  return apiPost('aopp/cancel');
};

export const approve = (): Promise<null> => {
  return apiPost('aopp/approve');
};

export const chooseAccount = (accountCode: AccountCode): Promise<null> => {
  return apiPost('aopp/choose-account', { accountCode });
};

export const getAOPP = (): Promise<Aopp> => {
  return apiGet('aopp');
};

export const subscribeAOPP = (
  cb: (aopp: Aopp) => void
): TUnsubscribe => {
  return subscribeEndpoint('aopp', cb);
};
