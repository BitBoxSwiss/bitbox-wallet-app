// SPDX-License-Identifier: Apache-2.0

import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions, TBalance } from '@/api/account';
import { Checkbox, Input } from '@/components/forms';
import style from './coin-input.module.css';

type TProps = {
  balance?: TBalance;
  onAmountChange: (amount: string) => void;
  onSendAllChange: (sendAll: boolean) => void;
  sendAll: boolean;
  amountError?: string;
  proposedAmount?: TAmountWithConversions;
  amount: string;
  hasSelectedUTXOs: boolean;
  disabled?: boolean;
};

export const CoinInput = ({
  balance,
  onAmountChange,
  onSendAllChange,
  sendAll,
  amountError,
  proposedAmount,
  amount,
  hasSelectedUTXOs,
  disabled = false,
}: TProps) => {
  const { t } = useTranslation();
  return (
    <Input
      type="number"
      step="any"
      min="0"
      label={balance ? balance.available.unit : t('send.amount.label')}
      id="amount"
      onInput={(e: ChangeEvent<HTMLInputElement>) => onAmountChange(e.target.value)}
      disabled={sendAll || disabled}
      error={amountError}
      value={sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount}
      placeholder={t('send.amount.placeholder')}
      labelSection={
        disabled ? undefined : (
          <Checkbox
            label={t(hasSelectedUTXOs ? 'send.maximumSelectedCoins' : 'send.maximum')}
            id="sendAll"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSendAllChange(e.target.checked)}
            checked={sendAll}
            className={style.maxAmount} />
        )
      }
    />
  );
};
