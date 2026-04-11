// SPDX-License-Identifier: Apache-2.0

import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import { AccountCode, ScriptType, TReceiveAddress } from '@/api/account';
import * as accountApi from '@/api/account';

export type TUsedAddressLoadErrorCode = 'syncInProgress' | 'notSupported' | 'loadFailed' | null;

export type TAddressSelector = {
  isUsedAddressRoute: boolean;
  dataLoaded: boolean;
  usedAddressLoadErrorCode: TUsedAddressLoadErrorCode;
  availableAddressCount: number;
  activeIndex: number;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  currentAddress: TReceiveAddress | null;
  addressString: string;
  scriptType: ScriptType | null;
  retryUsedAddressLoad: () => void;
};

// resolves which address to sign with. 2 "paths" are available:
// path 1 -> user picked an address from the used address list.
// path 2 – user selects the "sign message" option in account info.
export const useAddressSelector = (code: AccountCode): TAddressSelector => {
  const { addressID: usedAddressID } = useParams<{ addressID?: string }>();
  const isUsedAddressRoute = !!usedAddressID;
  const [activeIndex, setActiveIndex] = useState(0);
  const [usedAddressReloadVersion, setUsedAddressReloadVersion] = useState(0);

  const receiveAddresses = useLoad(
    isUsedAddressRoute ? null : accountApi.getReceiveAddressList(code),
    [code, isUsedAddressRoute],
  );
  const usedAddressResponse = useLoad(
    isUsedAddressRoute ? () => accountApi.getUsedAddresses(code) : null,
    [code, usedAddressReloadVersion, isUsedAddressRoute],
  );

  const currentReceiveAddressList = useMemo(() => {
    if (!receiveAddresses || receiveAddresses.length === 0) {
      return undefined;
    }
    const nativeSegwitAddresses = receiveAddresses.find(({ scriptType }) => scriptType === 'p2wpkh');
    return nativeSegwitAddresses || receiveAddresses[0];
  }, [receiveAddresses]);

  const currentAddress = useMemo(() => {
    if (isUsedAddressRoute) {
      if (!usedAddressID || !usedAddressResponse?.success) {
        return null;
      }
      const found = usedAddressResponse.addresses.find(a => a.addressID === usedAddressID);
      return found ? { address: found.address, addressID: found.addressID } : null;
    }
    return currentReceiveAddressList?.addresses[activeIndex] || null;
  }, [activeIndex, currentReceiveAddressList, usedAddressID, usedAddressResponse, isUsedAddressRoute]);

  const scriptType = isUsedAddressRoute
    ? null
    : currentReceiveAddressList?.scriptType ?? null;

  const dataLoaded = isUsedAddressRoute
    ? usedAddressResponse !== undefined
    : receiveAddresses !== undefined;

  const usedAddressLoadErrorCode = useMemo((): TUsedAddressLoadErrorCode => {
    if (!isUsedAddressRoute || usedAddressResponse === undefined || usedAddressResponse.success) {
      return null;
    }
    switch (usedAddressResponse.errorCode) {
    case 'syncInProgress':
    case 'notSupported':
      return usedAddressResponse.errorCode;
    default:
      return 'loadFailed';
    }
  }, [isUsedAddressRoute, usedAddressResponse]);

  const availableAddressCount = isUsedAddressRoute
    ? (currentAddress ? 1 : 0)
    : (currentReceiveAddressList?.addresses.length || 0);

  const addressString = currentAddress?.address ?? '';
  const retryUsedAddressLoad = useCallback(() => setUsedAddressReloadVersion(prev => prev + 1), []);

  return {
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
  };
};
