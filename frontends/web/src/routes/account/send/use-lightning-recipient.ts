// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import type { TAccount } from '@/api/account';
import { useLightning } from '@/hooks/lightning';

export const useLightningRecipient = (account: TAccount, fixed = false) => {
  const { lightningAccount, isLightningReady } = useLightning();
  const [manuallySelected, setSelected] = useState(false);
  const available = account.coinCode === 'btc' && !!lightningAccount;
  const readyAccountCode = available && isLightningReady ? lightningAccount.code : undefined;

  useEffect(() => {
    setSelected(false);
  }, [account.code, readyAccountCode]);

  return {
    available,
    readyAccountCode,
    selected: fixed || manuallySelected,
    select: () => setSelected(true),
    reset: () => setSelected(false),
  };
};
