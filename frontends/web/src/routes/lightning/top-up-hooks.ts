// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import * as accountApi from '@/api/account';
import type { TLightningAccount } from '@/api/lightning';
import { getBoardingAddress, getLightningBalance } from '@/api/lightning';
import { useLightning } from '@/hooks/lightning';
import { useMountedRef } from '@/hooks/mount';
import { findAccount } from '@/routes/account/utils';

type TUseTopUpSourceAccountProps = {
  activeAccounts: accountApi.TAccount[];
};

const isBitcoinSourceAccount = (account: accountApi.TAccount) => (
  account.coinCode === 'btc' && !account.isToken
);

const preferredAccountForLightning = (
  accounts: accountApi.TAccount[],
  lightningAccount: TLightningAccount | null,
) => {
  if (!lightningAccount) {
    return accounts[0];
  }
  return accounts.find(account => account.keystore.rootFingerprint === lightningAccount.rootFingerprint)
    || accounts[0];
};

export const getTopUpSourceAccounts = (activeAccounts: accountApi.TAccount[]) => (
  activeAccounts.filter(isBitcoinSourceAccount)
);

export const getTopUpAccountToConnect = (
  accounts: accountApi.TAccount[],
  activeAccounts: accountApi.TAccount[],
  lightningAccount: TLightningAccount | null,
) => {
  const bitcoinAccounts = accounts.filter(isBitcoinSourceAccount);
  const sourceAccounts = getTopUpSourceAccounts(activeAccounts);

  return preferredAccountForLightning(sourceAccounts, lightningAccount)
    || preferredAccountForLightning(bitcoinAccounts, lightningAccount);
};

export const useBoardingAddress = () => {
  const mounted = useMountedRef();
  const [boardingAddress, setBoardingAddress] = useState<string>();
  const [boardingAddressError, setBoardingAddressError] = useState<string>();

  useEffect(() => {
    getBoardingAddress()
      .then((address) => {
        if (mounted.current) {
          setBoardingAddress(address);
        }
      })
      .catch((err: any) => {
        if (mounted.current) {
          setBoardingAddressError(err?.message || err?.errorMessage || String(err));
        }
      });
  }, [mounted]);

  return { boardingAddress, boardingAddressError };
};

export const useLightningBalance = () => {
  const mounted = useMountedRef();
  const [balance, setBalance] = useState<accountApi.TBalance>();

  useEffect(() => {
    getLightningBalance()
      .then((nextBalance) => {
        if (mounted.current) {
          setBalance(nextBalance);
        }
      })
      .catch((err) => console.error('Failed to fetch lightning balance', err));
  }, [mounted]);

  return balance;
};

export const useTopUpSourceAccount = ({
  activeAccounts,
}: TUseTopUpSourceAccountProps) => {
  const { lightningAccount } = useLightning();

  const sourceAccounts = useMemo(() => (
    getTopUpSourceAccounts(activeAccounts)
  ), [activeAccounts]);

  const preferredAccount = useMemo(() => {
    return preferredAccountForLightning(sourceAccounts, lightningAccount);
  }, [lightningAccount, sourceAccounts]);

  const [sourceAccountCode, setSourceAccountCode] = useState<accountApi.AccountCode | undefined>(preferredAccount?.code);
  const sourceAccount = sourceAccountCode ? findAccount(sourceAccounts, sourceAccountCode) : undefined;

  useEffect(() => {
    if (sourceAccountCode && sourceAccounts.some(account => account.code === sourceAccountCode)) {
      return;
    }
    setSourceAccountCode(preferredAccount?.code);
  }, [preferredAccount?.code, sourceAccountCode, sourceAccounts]);

  return {
    setSourceAccountCode,
    sourceAccount,
    sourceAccountCode,
    sourceAccounts,
  };
};
