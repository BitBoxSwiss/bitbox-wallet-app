// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { getBoardingAddress } from '@/api/lightning';
import { useLightning } from '@/hooks/lightning';
import { useLoad } from '@/hooks/api';

type TRecipient = { address: string; error?: never } | { address?: never; error: string };

export const useLightningRecipient = (account: TAccount, fixed = false) => {
  const { t } = useTranslation();
  const { lightningAccount, isLightningReady } = useLightning();
  const [manuallySelected, setSelected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const selected = fixed || manuallySelected;
  const available = account.coinCode === 'btc' && !!lightningAccount;
  const reset = useCallback(() => setSelected(false), []);

  useEffect(() => {
    reset();
  }, [account.code, lightningAccount?.code, lightningAccount?.rootFingerprint, lightningAccount?.num, isLightningReady, reset]);

  const requestKey = JSON.stringify([
    account.code, lightningAccount?.code, lightningAccount?.rootFingerprint, lightningAccount?.num,
    available, isLightningReady, selected, attempt,
  ]);
  const recipient = useLoad<{ key: string; result: TRecipient }>(selected && available && isLightningReady ? async () => {
    try {
      return { key: requestKey, result: { address: await getBoardingAddress() } };
    } catch (error) {
      return { key: requestKey, result: { error: error instanceof Error ? error.message : t('genericError') } };
    }
  } : null, [requestKey]);

  return {
    available,
    ready: isLightningReady === true,
    // null means an ordinary recipient; undefined means the Lightning address is loading.
    recipient: selected ? (recipient?.key === requestKey ? recipient.result : undefined) : null,
    select: () => setSelected(true),
    retry: () => setAttempt(attempt => attempt + 1),
    reset,
  };
};
