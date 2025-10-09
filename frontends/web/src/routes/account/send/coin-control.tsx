/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IAccount } from '@/api/account';
import { getConfig } from '@/utils/config';
import { Button } from '@/components/forms';
import { TSelectedUTXOs, UTXOs } from './utxos';
import { isBitcoinBased } from '../utils';

type TProps = {
  account: IAccount;
  onSelectedUTXOsChange: (selectedUTXOs: TSelectedUTXOs) => void;
  onCoinControlDialogActiveChange?: (active: boolean) => void;
}

export const CoinControl = ({
  account,
  onSelectedUTXOsChange,
  onCoinControlDialogActiveChange,
}: TProps) => {
  const { t } = useTranslation();

  const [coinControlEnabled, setCoinControlEnabled] = useState(false);
  const [showUTXODialog, setShowUTXODialog] = useState(false);

  useEffect(() => {
    if (isBitcoinBased(account.coinCode)) {
      getConfig().then(config => {
        setCoinControlEnabled(!!(config.frontend || {}).coinControl);
      });
    }
  }, [account.coinCode]);

  // Notify parent whenever dialog visibility changes
  useEffect(() => {
    if (onCoinControlDialogActiveChange) {
      onCoinControlDialogActiveChange(showUTXODialog);
    }
  }, [showUTXODialog, onCoinControlDialogActiveChange]);

  if (!coinControlEnabled) {
    return null;
  }

  return (
    <>
      <UTXOs
        accountCode={account.code}
        active={showUTXODialog}
        explorerURL={account.blockExplorerTxPrefix}
        onClose={() => {
          setShowUTXODialog(false);
        }}
        onChange={onSelectedUTXOsChange} />
      <Button
        className="m-bottom-quarter p-right-none"
        transparent
        onClick={() => {
          setShowUTXODialog(showUTXODialog => !showUTXODialog);
        }}>
        {t('send.toggleCoinControl')}
      </Button>
    </>
  );
};
