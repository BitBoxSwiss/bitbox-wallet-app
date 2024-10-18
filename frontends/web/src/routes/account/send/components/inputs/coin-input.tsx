import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IAmount, IBalance } from '@/api/account';
import { TProposalError } from '@/routes/account/send/services';
import { Checkbox, Input } from '@/components/forms';
import style from './coin-input.module.css';

type TProps = {
    balance?: IBalance
    onAmountChange: (amount: string) => void;
    onSendAllChange: (sendAll: boolean) => void;
    sendAll: boolean;
    errorHandling: TProposalError;
    proposedAmount?: IAmount;
    amount: string;
    hasSelectedUTXOs: boolean;
}

export const CoinInput = ({
  balance,
  onAmountChange,
  onSendAllChange,
  sendAll,
  errorHandling,
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
      error={errorHandling.amountError}
      value={sendAll ? (proposedAmount ? proposedAmount.amount : amount) : amount}
      placeholder={t('send.amount.placeholder')}
      labelSection={
        <Checkbox
          disabled={!!errorHandling.feeError || !!errorHandling.addressError}
          label={t(hasSelectedUTXOs ? 'send.maximumSelectedCoins' : 'send.maximum')}
          id="sendAll"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSendAllChange(e.target.checked)}
          checked={sendAll}
          className={style.maxAmount} />
      }
    />
  );
};
