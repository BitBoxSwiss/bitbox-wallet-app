import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input } from '@/components/forms';
import { IAmount, IBalance } from '@/api/account';
import style from './coin-input.module.css';

type TProps = {
    balance?: IBalance
    onAmountChange: (amount: string) => void;
    onSendAllChange: (sendAll: boolean) => void;
    sendAll: boolean;
    amountError?: string;
    proposedAmount?: IAmount;
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