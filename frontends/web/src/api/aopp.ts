/**
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AccountCode } from './account';
import { apiGet, apiPost } from '../utils/request';
import type { TUnsubscribe } from '../utils/transport-common';
import { subscribeEndpoint } from './subscribe';

export interface Account {
    name: string;
    code: AccountCode;
}

interface Accounts extends Array<Account> {
    0: Account,
}

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
