// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { getConfig } from '@/utils/config';
import { Button } from '@/components/forms';
import { TSelectedUTXOs, UTXOs } from './utxos';
import { isBitcoinBased } from '../utils';
import style from './coin-control.module.css';

type TProps = {
  account: TAccount;
  onSelectedUTXOsChange: (selectedUTXOs: TSelectedUTXOs) => void;
  onCoinControlDialogActiveChange?: (active: boolean) => void;
};

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
        className={style.coinControlButton}
        transparent
        onClick={() => {
          setShowUTXODialog(showUTXODialog => !showUTXODialog);
        }}>
        {t('send.toggleCoinControl')}
      </Button>
    </>
  );
};
