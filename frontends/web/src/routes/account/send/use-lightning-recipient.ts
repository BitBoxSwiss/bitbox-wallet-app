// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { getBoardingAddress } from '@/api/lightning';
import { useLightning } from '@/hooks/lightning';
import { useMountedRef } from '@/hooks/mount';

type TRecipient = { address: string; error?: never } | { address?: never; error: string };

export const useLightningRecipient = (account: TAccount) => {
  const { t } = useTranslation();
  const { lightningAccount, isLightningReady } = useLightning();
  // null: ordinary recipient; undefined: loading the selected Lightning recipient.
  const [recipient, setRecipient] = useState<TRecipient | null | undefined>(null);
  const request = useRef(0);
  const mounted = useMountedRef();
  const available = account.coinCode === 'btc' && !!lightningAccount;

  const reset = useCallback(() => {
    request.current++;
    setRecipient(null);
  }, []);

  useEffect(() => {
    reset();
  }, [account.code, lightningAccount?.code, lightningAccount?.rootFingerprint, lightningAccount?.num, isLightningReady, reset]);

  const select = async () => {
    if (!available || !isLightningReady) {
      return;
    }
    const currentRequest = ++request.current;
    setRecipient(undefined);
    try {
      const address = await getBoardingAddress();
      if (currentRequest === request.current && mounted.current) {
        setRecipient({ address });
      }
    } catch (error) {
      if (currentRequest === request.current && mounted.current) {
        setRecipient({ error: error instanceof Error ? error.message : t('genericError') });
      }
    }
  };

  return { available, ready: isLightningReady === true, recipient, select, reset };
};
