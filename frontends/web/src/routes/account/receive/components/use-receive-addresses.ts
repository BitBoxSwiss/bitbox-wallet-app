// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';

const SCRIPT_TYPE_PRIORITY: accountApi.ScriptType[] = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh'];

export const useReceiveAddresses = (
  code: accountApi.AccountCode,
  preferredScriptType: accountApi.ScriptType | undefined,
) => {
  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code), [code]) ?? undefined;
  const [addressTypeIndex, setAddressTypeIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const availableScriptTypes = useMemo<accountApi.ScriptType[]>(() => {
    if (!receiveAddresses) {
      return [];
    }
    return SCRIPT_TYPE_PRIORITY.filter(st =>
      receiveAddresses.some(group => group.scriptType === st)
    );
  }, [receiveAddresses]);

  useEffect(() => {
    if (!receiveAddresses || availableScriptTypes.length === 0) {
      return;
    }
    const idx = preferredScriptType ? availableScriptTypes.indexOf(preferredScriptType) : -1;
    setAddressTypeIndex(idx >= 0 ? idx : 0);
  }, [preferredScriptType, availableScriptTypes, receiveAddresses]);

  useEffect(() => {
    setActiveIndex(0);
  }, [code, addressTypeIndex]);

  const currentScriptType = availableScriptTypes[addressTypeIndex];
  const currentGroup = receiveAddresses?.find(group => group.scriptType === currentScriptType)
    ?? receiveAddresses?.[0];
  const addresses = currentGroup?.addresses;
  const currentAddress = addresses?.[activeIndex];
  const hasMultipleScriptTypes = availableScriptTypes.length > 1;
  const hasMultipleAddresses = (addresses?.length ?? 0) > 1;

  return {
    availableScriptTypes,
    addressTypeIndex,
    setAddressTypeIndex,
    activeIndex,
    setActiveIndex,
    addresses,
    currentAddress,
    hasMultipleScriptTypes,
    hasMultipleAddresses,
  };
};
