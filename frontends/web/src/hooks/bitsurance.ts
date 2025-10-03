/**
 * Copyright 2025 Shift Crypto AG
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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { bitsuranceLookup } from '@/api/bitsurance';
import { alertUser } from '@/components/alert/Alert';
import { getConfig, setConfig } from '@/utils/config';
import { getScriptName } from '@/routes/account/utils';

/**
 * Custom hook for managing Bitsurance coverage state for an account.
 *
 * This hook encapsulates the logic of checking whether an account is insured
 * via Bitsurance and whether it contains any uncovered UTXOs (non-segwit outputs).
 *
 * It performs the following:
 * - Looks up the account's Bitsurance status via the backend API.
 * - Alerts the user if insurance has expired or lookup fails.
 * - Tracks whether the account is currently insured (`insured`).
 * - Checks for and lists uncovered UTXOs (legacy script types).
 * - Provides helpers to clear or manually update uncovered funds.
 *
 * @param account - The account object to check (optional).
 * @param code - The account code used for API calls.
 *
 * @returns {Object} - Bitsurance state and helpers:
 *   - insured: `boolean` indicating if the account is actively insured.
 *   - uncoveredFunds: `string[]` list of human-readable uncovered UTXO script types.
 *   - clearUncoveredFunds: helper to reset uncovered funds to an empty list.
 *
 * Usage:
 * ```tsx
 * const { insured, uncoveredFunds, clearUncoveredFunds } = useBitsurance(code, account);
 *
 * return (
 *   <Dialog open={insured && uncoveredFunds.length > 0} onClose={clearUncoveredFunds}>
 *     ...
 *   </Dialog>
 * );
 * ```
 */
export const useBitsurance = (
  code: accountApi.AccountCode,
  account?: accountApi.IAccount,
) => {
  const { t } = useTranslation();

  const [insured, setInsured] = useState(false);
  const [uncoveredFunds, setUncoveredFunds] = useState<string[]>([]);

  const clearUncoveredFunds = useCallback(() => setUncoveredFunds([]), []);

  const checkUncoveredUTXOs = useCallback(async () => {
    const uncoveredScripts: accountApi.ScriptType[] = [];
    const utxos = await accountApi.getUTXOs(code);
    utxos.forEach((utxo) => {
      if (utxo.scriptType !== 'p2wpkh' && !uncoveredScripts.includes(utxo.scriptType)) {
        uncoveredScripts.push(utxo.scriptType);
      }
    });
    setUncoveredFunds(uncoveredScripts.map(getScriptName));
  }, [code]);

  const maybeCheckBitsuranceStatus = useCallback(async () => {
    if (!account?.bitsuranceStatus) {
      setInsured(false);
      return;
    }

    const insuredAccounts = await bitsuranceLookup(code);
    if (!insuredAccounts.success) {
      alertUser(insuredAccounts.errorMessage || t('genericError'));
      return;
    }

    // we fetch the config after the lookup as it could have changed.
    const config = await getConfig();
    let cancelledAccounts: string[] = config.frontend.bitsuranceNotifyCancellation;

    if (cancelledAccounts?.includes(code)) {
      alertUser(t('account.insuranceExpired'));
      // remove the pending notification from the frontend settings.
      config.frontend.bitsuranceNotifyCancellation = cancelledAccounts.filter(accountCode => accountCode !== code);
      setConfig(config);
    }

    const bitsuranceAccount = insuredAccounts.bitsuranceAccounts[0];
    if (bitsuranceAccount?.status === 'active') {
      setInsured(true);
      checkUncoveredUTXOs();
      return;
    }

    setInsured(false);
  }, [t, account, code, checkUncoveredUTXOs]);

  useEffect(() => {
    maybeCheckBitsuranceStatus();
  }, [maybeCheckBitsuranceStatus]);

  return {
    insured,
    uncoveredFunds,
    clearUncoveredFunds,
  };
};
