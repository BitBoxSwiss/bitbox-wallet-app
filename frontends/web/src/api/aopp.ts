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
  requestID: number;
  errorCode: 'aoppUnsupportedAsset' | 'aoppVersion' | 'aoppInvalidRequest' | 'aoppNoAccounts' | 'aoppUnsupportedKeystore' | 'aoppUnknown' | 'aoppSigningAborted' | 'aoppCallback';
  callback: string;
} | {
  state: 'inactive';
} | {
  state: 'user-approval' | 'awaiting-keystore' | 'syncing';
  requestID: number;
  message: string;
  callback: string;
  xpubRequired: boolean;
} | {
  state: 'choosing-account';
  requestID: number;
  accounts: Accounts;
  message: string;
  callback: string;
} | {
  state: 'signing' | 'success';
  requestID: number;
  address: string;
  displayAddress: string;
  addressID: string;
  message: string;
  callback: string;
  accountCode: AccountCode;
};

export const cancel = (requestID: number): Promise<TActionResponse> => {
  return apiPost('aopp/cancel', { requestID });
};

export const approve = (requestID: number): Promise<TActionResponse> => {
  return apiPost('aopp/approve', { requestID });
};

type TActionResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const chooseAccount = (requestID: number, accountCode: AccountCode): Promise<TActionResponse> => {
  return apiPost('aopp/choose-account', { requestID, accountCode });
};

export const getAOPP = (): Promise<Aopp> => {
  return apiGet('aopp');
};

export const subscribeAOPP = (
  cb: (aopp: Aopp) => void
): TUnsubscribe => {
  return subscribeEndpoint('aopp', cb);
};
