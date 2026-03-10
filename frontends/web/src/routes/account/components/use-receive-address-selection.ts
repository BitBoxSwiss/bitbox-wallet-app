// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from 'react';
import * as accountApi from '@/api/account';
import { getIndexOfMatchingScriptType, scriptTypes } from './address-type-dialog';

type TProps = {
  receiveAddresses: accountApi.TReceiveAddressList[] | null | undefined;
  onAddressTypeChosen?: () => void;
};

type TResult = {
  addressType: number;
  addressTypeDialog: boolean;
  setAddressTypeDialog: (open: boolean) => void;
  currentAddresses: accountApi.TReceiveAddress[] | undefined;
  currentAddressIndex: number;
  availableScriptTypes: accountApi.ScriptType[] | undefined;
  hasManyScriptTypes: boolean;
  handleAddressTypeChosen: (addressType: number) => void;
};

export const useReceiveAddressSelection = ({
  receiveAddresses,
  onAddressTypeChosen,
}: TProps): TResult => {
  // index into `availableScriptTypes`, or 0 if none are available.
  const [addressType, setAddressType] = useState<number>(0);
  const [addressTypeDialog, setAddressTypeDialog] = useState<boolean>(false);

  const availableScriptTypes = useMemo(() => {
    if (!receiveAddresses) {
      return undefined;
    }
    // All script types that are present in the addresses delivered by the backend.
    // Will be empty if there are no such addresses, e.g. in Ethereum.
    return scriptTypes.filter(scriptType => getIndexOfMatchingScriptType(receiveAddresses, scriptType) >= 0);
  }, [receiveAddresses]);

  const hasManyScriptTypes = (availableScriptTypes?.length || 0) > 1;

  const selectedAddressType = availableScriptTypes?.length
    ? Math.min(addressType, availableScriptTypes.length - 1)
    : 0;

  const currentAddressIndex = useMemo(() => {
    if (!receiveAddresses || !availableScriptTypes || availableScriptTypes.length === 0) {
      return 0;
    }
    const addressIndex = getIndexOfMatchingScriptType(
      receiveAddresses,
      availableScriptTypes[selectedAddressType]!,
    );
    return addressIndex === -1 ? 0 : addressIndex;
  }, [availableScriptTypes, receiveAddresses, selectedAddressType]);

  const currentAddresses = useMemo(() => {
    if (!receiveAddresses) {
      return undefined;
    }
    return receiveAddresses[currentAddressIndex]?.addresses;
  }, [currentAddressIndex, receiveAddresses]);

  const handleAddressTypeChosen = useCallback((newAddressType: number) => {
    setAddressType(newAddressType);
    setAddressTypeDialog(false);
    onAddressTypeChosen?.();
  }, [onAddressTypeChosen]);

  return {
    addressType: selectedAddressType,
    addressTypeDialog,
    setAddressTypeDialog,
    currentAddresses,
    currentAddressIndex,
    availableScriptTypes,
    hasManyScriptTypes,
    handleAddressTypeChosen,
  };
};
