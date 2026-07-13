// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import * as accountApi from '@/api/account';
import { isEthereumBased } from '@/utils/coin';

const activityRefreshMs = 30_000;

export const useEthAccountActivity = (
  code: accountApi.AccountCode,
  coinCode: accountApi.CoinCode | undefined,
) => {
  useEffect(() => {
    // This is only needed for Ethereum based accounts for faster incoming transaction discovery
    if (coinCode === undefined || !isEthereumBased(coinCode)) {
      return;
    }

    // Ethereum-based accounts can discover incoming transactions from cheap
    // balance probes between slower full history syncs.
    const setActive = (active: boolean) => {
      accountApi.postEthAccountActivity(code, active).catch(console.error);
    };

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setActive(true);
      }
    };

    const handleVisibilityChange = () => {
      setActive(document.visibilityState === 'visible');
    };

    refresh();
    const intervalID = window.setInterval(refresh, activityRefreshMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalID);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setActive(false);
    };
  }, [code, coinCode]);
};
