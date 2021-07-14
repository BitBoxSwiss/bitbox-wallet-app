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
import { apiPost } from '../utils/request';

export interface Account {
    name: string;
    code: AccountCode;
}

interface Accounts extends Array<Account> {
    0: Account,
}

type AOPPWithAccounts = {
    // See backend/aopp.go for a description of the states.
    state: 'inactive' | 'user-approval' | 'choosing-account' | 'signing' | 'success';
    accounts: Accounts;
}

type AOPPWithoutAccounts = {
    // See backend/aopp.go for a description of the states.
    state: 'error' | 'awaiting-keystore' | 'syncing';
    accounts: null;
}

type AOPPAccountIndependent = {
    // See backend/errors.go for a description of the errors.
    errorCode: '' | 'aoppUnsupportedAsset' | 'aoppVersion' | 'aoppInvalidRequest' | 'aoppNoAccounts' | 'aoppUnsupportedKeystore' | 'aoppUnknown' | 'aoppSigningAborted' | 'aoppCallback';
    address: string;
    callback: string;
    message: string;
}

export type Aopp = (AOPPWithAccounts | AOPPWithoutAccounts) & AOPPAccountIndependent;

export const cancel = (): Promise<null> => {
    return apiPost('aopp/cancel');
};

export const approve = (): Promise<null> => {
    return apiPost('aopp/approve');
};

export const chooseAccount = (accountCode: AccountCode): Promise<null> => {
    return apiPost('aopp/choose-account', { accountCode });
};
