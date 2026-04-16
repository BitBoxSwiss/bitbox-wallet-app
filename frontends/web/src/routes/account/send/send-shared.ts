// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback, useEffect } from 'react';
import type { BtcUnit } from '@/api/coins';
import type { AccountCode, TBalance } from '@/api/account';
import * as accountApi from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { useMountedRef } from '@/hooks/mount';

export const useAccountBalance = (accountCode: AccountCode, btcUnit?: BtcUnit) => {
  const mounted = useMountedRef();
  const [balance, setBalance] = useState<TBalance>();

  const updateBalance = useCallback(async (code: AccountCode) => {
    if (mounted.current) {
      const result = await accountApi.getBalance(code);
      if (result.success && mounted.current) {
        setBalance(result.balance);
      }
    }
  }, [mounted]);

  useEffect(() => {
    updateBalance(accountCode);
    return syncdone(accountCode, () => updateBalance(accountCode));
  }, [accountCode, updateBalance, btcUnit]);

  return balance;
};
