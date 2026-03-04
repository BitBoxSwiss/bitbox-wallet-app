// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { getScriptName } from '@/routes/account/utils';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Radio } from '@/components/forms';
import { Message } from '@/components/message/message';
import style from './address-type-dialog.module.css';

// For BTC/LTC: all possible address types we want to offer to the user, ordered by priority (first one is default).
// Types that are not available in the addresses delivered by the backend should be ignored.
export const scriptTypes: accountApi.ScriptType[] = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh'];

// Find index in list of receive addresses that matches the given script type, or -1 if not found.
export const getIndexOfMatchingScriptType = (
  receiveAddresses: accountApi.TReceiveAddressList[],
  scriptType: accountApi.ScriptType
): number => {
  return receiveAddresses.findIndex(addrs => addrs.scriptType !== null && scriptType === addrs.scriptType);
};

type TAddressTypeDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedAddressType: number;
  availableScriptTypes?: accountApi.ScriptType[];
  insured: boolean;
  handleAddressTypeChosen: (addressType: number) => void;
};

export const AddressTypeDialog = ({
  open,
  setOpen,
  preselectedAddressType,
  availableScriptTypes,
  insured,
  handleAddressTypeChosen,
}: TAddressTypeDialogProps) => {
  const { t } = useTranslation();
  const [addressType, setAddressType] = useState<number>(preselectedAddressType);

  useEffect(() => {
    if (open) {
      setAddressType(preselectedAddressType);
    }
  }, [open, preselectedAddressType]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} medium title={t('receive.changeScriptType')}>
      <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleAddressTypeChosen(addressType);
      }}>
        {availableScriptTypes && availableScriptTypes.map((scriptType, i) => (
          <div key={scriptType}>
            <Radio
              checked={addressType === i}
              id={scriptType}
              name="scriptType"
              onChange={() => setAddressType(i)}
              title={getScriptName(scriptType)}>
              {t(`receive.scriptType.${scriptType}`)}
            </Radio>
            {scriptType === 'p2tr' && addressType === i && (
              <Message type="warning" className={style.messageContainer}>
                {t('receive.taprootWarning')}
              </Message>
            )}
          </div>
        ))}
        {insured && (
          <Message type="warning">
            {t('receive.bitsuranceWarning')}
          </Message>
        )}
        <DialogButtons>
          <Button primary type="submit">
            {t('button.done')}
          </Button>
        </DialogButtons>
      </form>
    </Dialog>
  );
};
