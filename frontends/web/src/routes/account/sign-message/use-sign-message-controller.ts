// SPDX-License-Identifier: Apache-2.0

import { SyntheticEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import {
  TSignatureResult,
  TSigningState,
  useSignMessage,
} from '../receive/components/use-sign-message';
import { useKeystoreConnection } from '../components/use-keystore-connection';
import { useReceiveAddressSelection } from '../components/use-receive-address-selection';
import { findAccount, isMessageSigningSupported } from '../utils';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

export type TFixedAddressLoadErrorCode = 'syncInProgress' | 'notSupported' | 'loadFailed' | null;

type TResult = {
  account: accountApi.TAccount | null;
  isFixedAddressRoute: boolean;
  backPath: string;
  insured: boolean;
  isMessageSigningAvailable: boolean;
  isLoading: boolean;
  fixedAddressLoadErrorCode: TFixedAddressLoadErrorCode;
  availableAddressCount: number;
  activeIndex: number;
  address: string;
  addressType: number;
  addressTypeDialog: boolean;
  setAddressTypeDialog: (open: boolean) => void;
  availableScriptTypes: accountApi.ScriptType[] | undefined;
  hasManyScriptTypes: boolean;
  handleAddressTypeChosen: (newAddressType: number) => void;
  message: string;
  setMessage: (message: string) => void;
  state: TSigningState;
  error: string | null;
  result: TSignatureResult | null;
  isUnsupported: boolean;
  isTaproot: boolean;
  handleSign: () => Promise<void>;
  reset: () => void;
  connectingKeystore: boolean;
  keystoreConnected: boolean;
  bypassConnectionGate: boolean;
  retryKeystoreConnection: () => void;
  previous: (event: SyntheticEvent) => void;
  next: (event: SyntheticEvent) => void;
  goBack: () => void;
  retryFixedAddressLoad: () => void;
};

export const useSignMessageController = ({
  accounts,
  code,
}: TProps): TResult => {
  const navigate = useNavigate();
  const { addressID: fixedAddressID } = useParams<{ addressID?: string }>();
  const isFixedAddressRoute = !!fixedAddressID;
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [fixedAddressReloadVersion, setFixedAddressReloadVersion] = useState(0);

  const account = findAccount(accounts, code);
  const isMessageSigningAvailable = account ? isMessageSigningSupported(account.coinCode) : false;
  const insured = account?.bitsuranceStatus === 'active';
  const listPath = `/account/${code}/addresses`;
  const infoPath = `/account/${code}/info`;
  const backPath = isFixedAddressRoute ? listPath : infoPath;

  const receiveAddresses = useLoad(isFixedAddressRoute ? null : accountApi.getReceiveAddressList(code));
  const fixedAddressResponse = useLoad(
    isFixedAddressRoute ? () => accountApi.getUsedAddresses(code) : null,
    [code, fixedAddressReloadVersion, isFixedAddressRoute],
  );

  const {
    addressType,
    addressTypeDialog,
    setAddressTypeDialog,
    currentAddresses,
    currentAddressIndex,
    availableScriptTypes,
    hasManyScriptTypes,
    handleAddressTypeChosen: chooseAddressType,
  } = useReceiveAddressSelection({ receiveAddresses });

  const fixedAddress = useMemo(() => {
    if (!isFixedAddressRoute || !fixedAddressID || !fixedAddressResponse?.success) {
      return null;
    }
    return fixedAddressResponse.addresses.find(address => address.addressID === fixedAddressID) || null;
  }, [fixedAddressID, fixedAddressResponse, isFixedAddressRoute]);

  const currentAddress = useMemo(() => {
    if (isFixedAddressRoute) {
      return fixedAddress
        ? { address: fixedAddress.address, addressID: fixedAddress.addressID }
        : null;
    }
    return currentAddresses?.[activeIndex] || null;
  }, [activeIndex, currentAddresses, fixedAddress, isFixedAddressRoute]);

  const currentScriptType = isFixedAddressRoute
    ? fixedAddress?.scriptType
    : receiveAddresses?.[currentAddressIndex]?.scriptType;
  const isLoading = isFixedAddressRoute ? fixedAddressResponse === undefined : receiveAddresses === undefined;

  const fixedAddressLoadErrorCode = useMemo<TFixedAddressLoadErrorCode>(() => {
    if (!isFixedAddressRoute || fixedAddressResponse === undefined || fixedAddressResponse.success) {
      return null;
    }
    switch (fixedAddressResponse.errorCode) {
    case 'syncInProgress':
    case 'notSupported':
      return fixedAddressResponse.errorCode;
    default:
      return 'loadFailed';
    }
  }, [fixedAddressResponse, isFixedAddressRoute]);

  const {
    message,
    setMessage,
    state,
    error,
    result,
    isUnsupported,
    isTaproot,
    handleSign,
    reset,
  } = useSignMessage({
    accountCode: code,
    address: currentAddress,
    onClose: isFixedAddressRoute ? () => navigate(backPath, { replace: true }) : undefined,
    scriptType: currentScriptType,
  });

  const handleAddressTypeChosen = (newAddressType: number) => {
    setActiveIndex(0);
    chooseAddressType(newAddressType);
    reset();
  };

  const handleConnectAbort = useCallback(() => {
    navigate(backPath, { replace: true });
  }, [backPath, navigate]);

  const {
    connected: keystoreConnected,
    connecting: connectingKeystore,
    retry: retryKeystoreConnection,
  } = useKeystoreConnection({
    enabled: !!account && isMessageSigningAvailable && !!currentAddress,
    rootFingerprint: account?.keystore.rootFingerprint,
    onUserAbort: handleConnectAbort,
  });

  const availableAddressCount = isFixedAddressRoute
    ? (currentAddress ? 1 : 0)
    : (currentAddresses?.length || 0);

  const previous = (event: SyntheticEvent) => {
    event.preventDefault();
    if (state !== 'signing' && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      reset();
    }
  };

  const next = (event: SyntheticEvent) => {
    event.preventDefault();
    if (state !== 'signing' && activeIndex < availableAddressCount - 1) {
      setActiveIndex(activeIndex + 1);
      reset();
    }
  };

  const bypassConnectionGate = isFixedAddressRoute && availableAddressCount === 0;
  const address = currentAddress?.address ?? '';
  const goBack = () => navigate(backPath, { replace: isFixedAddressRoute });
  const retryFixedAddressLoad = () => setFixedAddressReloadVersion(prev => prev + 1);

  return {
    account: account ?? null,
    isFixedAddressRoute,
    backPath,
    insured,
    isMessageSigningAvailable,
    isLoading,
    fixedAddressLoadErrorCode,
    availableAddressCount,
    activeIndex,
    address,
    addressType,
    addressTypeDialog,
    setAddressTypeDialog,
    availableScriptTypes,
    hasManyScriptTypes,
    handleAddressTypeChosen,
    message,
    setMessage,
    state,
    error,
    result,
    isUnsupported,
    isTaproot,
    handleSign,
    reset,
    connectingKeystore,
    keystoreConnected,
    bypassConnectionGate,
    retryKeystoreConnection,
    previous,
    next,
    goBack,
    retryFixedAddressLoad,
  };
};
