// SPDX-License-Identifier: Apache-2.0

import type { TAccountCode } from './account';
import { apiGet, apiPost } from '@/utils/request';

export type TDetailStatus = 'active' | 'processing' | 'refused' | 'waitpayment' | 'inactive' | 'canceled';

export type TAccountDetails = {
  code: TAccountCode;
  status: TDetailStatus;
  details: {
    maxCoverage: number;
    maxCoverageFormatted: string;
    currency: string;
    support: string;
  };
};

type TInsuredAccounts = {
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
export const bitsuranceLookup = (code: TAccountCode = ''): Promise<TInsuredAccounts> => {
  return apiPost('bitsurance/lookup', { code });
};
