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

import { apiGet } from '../utils/request';
import { AccountCode } from './account';

export type TInsuredAccounts = {
  success: boolean;
  errorMessage: string;
  accountCodes: AccountCode[];
};
export const getBitsuranceURL = (): Promise<string> => {
  return apiGet('bitsurance/url');
};

export const bitsuranceLookup = (code?: AccountCode): Promise<TInsuredAccounts> => {
  return apiGet(`bitsurance/lookup?code=${code || ''}`);
};
