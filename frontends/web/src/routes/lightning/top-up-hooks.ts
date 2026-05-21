// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import * as accountApi from '@/api/account';
import { getBoardingAddress, getLightningBalance, getTopUpInfo, type TTopUpInfo } from '@/api/lightning';
import { useMountedRef } from '@/hooks/mount';
import { findAccount } from '@/routes/account/utils';

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

export const useTopUpSourceAccount = () => {
  const mounted = useMountedRef();
  const [topUpInfo, setTopUpInfo] = useState<TTopUpInfo>();
  const [topUpInfoError, setTopUpInfoError] = useState<string>();
  const [sourceAccountCode, setSourceAccountCode] = useState<accountApi.AccountCode>();

  useEffect(() => {
    getTopUpInfo()
      .then((info) => {
        if (mounted.current) {
          setTopUpInfo(info);
          if (!info.success) {
            setTopUpInfoError(info.errorMessage);
          }
        }
      })
      .catch((err: any) => {
        if (mounted.current) {
          setTopUpInfoError(err?.message || err?.errorMessage || String(err));
        }
      });
  }, [mounted]);

  const sourceAccounts = topUpInfo?.success ? topUpInfo.sourceAccounts : undefined;
  const defaultSourceAccountCode = topUpInfo?.success ? topUpInfo.defaultSourceAccountCode : undefined;
  const sourceAccount = sourceAccountCode && sourceAccounts ? findAccount(sourceAccounts, sourceAccountCode) : undefined;

  useEffect(() => {
    if (!sourceAccounts) {
      return;
    }
    if (sourceAccountCode && sourceAccounts.some(account => account.code === sourceAccountCode)) {
      return;
    }
    setSourceAccountCode(defaultSourceAccountCode);
  }, [defaultSourceAccountCode, sourceAccountCode, sourceAccounts]);

  return {
    setSourceAccountCode,
    sourceAccount,
    sourceAccountCode,
    sourceAccounts,
    topUpInfoError,
  };
};
