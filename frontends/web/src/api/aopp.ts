// SPDX-License-Identifier: Apache-2.0

import type { TAccountCode } from './account';
import type { TUnsubscribe } from '@/utils/transport-common';
import type { NonEmptyArray } from '@/utils/types';
import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint } from './subscribe';

type TAccount = {
  name: string;
  code: TAccountCode;
};

type TAccounts = NonEmptyArray<TAccount>;

export type TAopp = {
  state: 'error';
  errorCode: 'aoppUnsupportedAsset' | 'aoppVersion' | 'aoppInvalidRequest' | 'aoppNoAccounts' | 'aoppUnsupportedKeystore' | 'aoppUnknown' | 'aoppSigningAborted' | 'aoppCallback' | 'firmwareUpgradeRequired';
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
  accounts: TAccounts;
  message: string;
  callback: string;
} | {
  state: 'signing' | 'success';
  address: string;
  displayAddress: string;
  addressID: string;
  message: string;
  callback: string;
  accountCode: TAccountCode;
};

export const cancel = (): Promise<null> => {
  return apiPost('aopp/cancel');
};

export const approve = (): Promise<null> => {
  return apiPost('aopp/approve');
};

type TChooseAccountResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const chooseAccount = (accountCode: TAccountCode): Promise<TChooseAccountResponse> => {
  return apiPost('aopp/choose-account', { accountCode });
};

export const getAOPP = (): Promise<TAopp> => {
  return apiGet('aopp');
};

export const subscribeAOPP = (
  cb: (aopp: TAopp) => void
): TUnsubscribe => {
  return subscribeEndpoint('aopp', cb);
};
