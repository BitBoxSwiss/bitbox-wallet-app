/**
 * Copyright 2023-2025 Shift Crypto AG
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

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input } from '@/components/forms';
import { TAmountWithConversions, IBalance } from '@/api/account';
import style from './coin-input.module.css';

type TProps = {
  balance?: IBalance;
  onAmountChange: (amount: string) => void;
  onSendAllChange: (sendAll: boolean) => void;
  sendAll: boolean;
  amountError?: string;
  proposedAmount?: TAmountWithConversions;
  amount: string;
  hasSelectedUTXOs: boolean;
}

export const CoinInput = ({
  balance,
  onAmountChange,
  onSendAllChange,
  sendAll,
  amountError,
  proposedAmount,
  amount,
  hasSelectedUTXOs
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
      disabled={sendAll}
      error={amountError}
      value={sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount}
      placeholder={t('send.amount.placeholder')}
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
