/**
 * Copyright 2022 Shift Crypto AG
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

export type AddressSignResponse = {
  success: boolean;
  abort: boolean;
  signature: string;
  address: string;
  error: string;
}

export const isMoonpayBuySupported = (code: string) => {
  return (): Promise<boolean> => {
    return apiGet(`exchange/moonpay/buy-supported/${code}`);
  };
};

export const signAddress = (format: string, msg: string, accountCode: AccountCode): Promise<AddressSignResponse> => {
  return apiPost('exchange/pocket/sign-address', { format, msg, accountCode });
};

export const getPocketURL = (accountCode: string) => {
  return (): Promise<string> => {
    return apiGet(`exchange/pocket/api-url/${accountCode}`);
  };
};

export const isPocketSupported = (accountCode: string) => {
  return (): Promise<boolean> => {
    return apiGet(`exchange/pocket/buy-supported/${accountCode}`);
  };
};
