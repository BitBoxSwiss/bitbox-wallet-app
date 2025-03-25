/**
 * Copyright 2023 Shift Crypto AG
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

import { apiGet, apiPost } from '@/utils/request';
import { AccountCode } from './account';

export type TDetailStatus =
  | 'active'
  | 'processing'
  | 'refused'
  | 'waitpayment'
  | 'inactive'
  | 'canceled';

export type TAccountDetails = {
  code: AccountCode;
  status: TDetailStatus;
  details: {
    maxCoverage: number;
    maxCoverageFormatted: string;
    currency: string;
    support: string;
  };
};

export type TInsuredAccounts = {
  success: boolean;
  errorMessage: string;
  bitsuranceAccounts: TAccountDetails[];
};
export const getBitsuranceURL = (): Promise<string> => {
  return apiGet('bitsurance/url');
};

// bitsuranceLook fetches the insurance status of the specified or all active BTC accounts
// and updates the account configuration based on the retrieved information. If the accountCode is
// provided, it checks the insurance status for that specific account; otherwise, it checks
// the status for all active BTC accounts.
export const bitsuranceLookup = (
  code: AccountCode = '',
): Promise<TInsuredAccounts> => {
  return apiPost('bitsurance/lookup', { code });
};
