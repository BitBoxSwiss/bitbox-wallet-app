import { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input } from '../../../../../components/forms';
import { IAmount, IBalance } from '../../../../../api/account';
import style from '../../send.module.css';

type TProps = {
    balance?: IBalance
    onInputChange: (e: SyntheticEvent) => void;
    sendAll: boolean;
    amountError?: string;
    proposedAmount?: IAmount;
    amount: string;
    hasSelectedUTXOs: boolean;
}

export const CoinInput = ({
  balance,
  onInputChange,
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
      onInput={onInputChange}
      disabled={sendAll}
      error={amountError}
      value={sendAll ? (proposedAmount ? proposedAmount.amount : '') : amount}
      placeholder={t('send.amount.placeholder')}
      labelSection={
        <Checkbox
          label={t(hasSelectedUTXOs ? 'send.maximumSelectedCoins' : 'send.maximum')}
          id="sendAll"
          onChange={onInputChange}
          checked={sendAll}
          className={style.maxAmount} />
      }
    />
  );
};