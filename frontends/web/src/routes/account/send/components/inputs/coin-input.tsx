// SPDX-License-Identifier: Apache-2.0

import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions, TBalance } from '@/api/account';
import { Checkbox, NumberInput } from '@/components/forms';
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
  hideValue?: boolean;
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
  hideValue = false
}: TProps): JSX.Element => {
  const { t } = useTranslation();
  const value = hideValue ? '' : sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount;

  return (
    <NumberInput
      step="any"
      min="0"
      label={balance ? balance.available.unit : t('send.amount.label')}
      id="amount"
      onChange={onAmountChange}
      disabled={sendAll}
      error={amountError}
      value={value}
      placeholder={hideValue ? '***' : t('send.amount.placeholder')}
      labelSection={
        <Checkbox
          label={t(hasSelectedUTXOs ? 'send.maximumSelectedCoins' : 'send.maximum')}
          id="sendAll"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSendAllChange(e.target.checked)}
          checked={sendAll}
          className={style.maxAmount} />
      }
    />
  );
};
