// SPDX-License-Identifier: Apache-2.0

import { SyntheticEvent, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import {
  TSignatureResult,
  TSigningState,
  useSignMessage,
} from './use-sign-message';
import {
  TUsedAddressLoadErrorCode,
  useAddressSelector,
} from './use-address-selector';
import { findAccount } from '../utils';

export type { TUsedAddressLoadErrorCode } from './use-address-selector';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

export type TSignMessageController = {
  account: accountApi.TAccount | null;
  isUsedAddressRoute: boolean;
  dataLoaded: boolean;
  usedAddressLoadErrorCode: TUsedAddressLoadErrorCode;
  availableAddressCount: number;
  activeIndex: number;
  address: string;
  message: string;
  setMessage: (message: string) => void;
  state: TSigningState;
  error: string | null;
  result: TSignatureResult | null;
  isTaprootAddress: boolean;
  handleSign: () => Promise<void>;
  previous: (event: SyntheticEvent) => void;
  next: (event: SyntheticEvent) => void;
  goBack: () => void;
  retryUsedAddressLoad: () => void;
};

export const useSignMessageController = ({
  accounts,
  code,
}: TProps): TSignMessageController => {
  const navigate = useNavigate();
  const account = findAccount(accounts, code);

  const {
    isUsedAddressRoute,
    dataLoaded,
    usedAddressLoadErrorCode,
    availableAddressCount,
    activeIndex,
    setActiveIndex,
    currentAddress,
    addressString,
    scriptType,
    retryUsedAddressLoad,
  } = useAddressSelector(code);

  const {
    message,
    setMessage,
    state,
    error,
    result,
    isTaprootAddress,
    handleSign,
    reset,
  } = useSignMessage({
    accountCode: code,
    coinCode: account?.coinCode,
    address: currentAddress,
    rootFingerprint: account?.keystore.rootFingerprint,
    scriptType,
  });

  const previous = useCallback((event: SyntheticEvent) => {
    event.preventDefault();
    if (state !== 'signing' && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
      reset();
    }
  }, [state, reset, activeIndex, setActiveIndex]);

  const next = useCallback((event: SyntheticEvent) => {
    event.preventDefault();
    if (state !== 'signing' && activeIndex < availableAddressCount - 1) {
      setActiveIndex(prev => prev + 1);
      reset();
    }
  }, [state, reset, activeIndex, availableAddressCount, setActiveIndex]);

  const backPath = useMemo(() => {
    const listPath = `/account/${code}/addresses`;
    const infoPath = `/account/${code}/info`;
    return isUsedAddressRoute ? listPath : infoPath;
  }, [code, isUsedAddressRoute]);

  const goBack = useCallback(
    () => navigate(backPath, { replace: isUsedAddressRoute }),
    [navigate, backPath, isUsedAddressRoute],
  );

  return {
    account: account ?? null,
    isUsedAddressRoute,
    dataLoaded,
    usedAddressLoadErrorCode,
    availableAddressCount,
    activeIndex,
    address: addressString,
    message,
    setMessage,
    state,
    error,
    result,
    isTaprootAddress,
    handleSign,
    previous,
    next,
    goBack,
    retryUsedAddressLoad,
  };
};
