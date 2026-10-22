// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { getBoardingAddress } from '@/api/lightning';
import { useLightning } from '@/hooks/lightning';
import { useLoad } from '@/hooks/api';

type TRecipient = { address: string; error?: never } | { address?: never; error: string };

export const useLightningRecipient = (account: TAccount) => {
  const { t } = useTranslation();
  const { lightningAccount, isLightningReady } = useLightning();
  const [selected, setSelected] = useState(false);
  const available = account.coinCode === 'btc' && !!lightningAccount;
  const reset = useCallback(() => setSelected(false), []);

  useEffect(() => {
    reset();
  }, [account.code, lightningAccount?.code, lightningAccount?.rootFingerprint, lightningAccount?.num, isLightningReady, reset]);

  const recipient = useLoad<TRecipient>(selected && available && isLightningReady ? async () => {
    try {
      return { address: await getBoardingAddress() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : t('genericError') };
    }
  } : null, [selected]);

  return {
    available,
    ready: isLightningReady === true,
    // null means an ordinary recipient; undefined means the Lightning address is loading.
    recipient: selected ? recipient : null,
    select: () => setSelected(true),
    reset,
  };
};
