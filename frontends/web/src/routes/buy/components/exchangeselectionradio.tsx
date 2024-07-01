/**
 * Copyright 2022 Shift Crypto AG
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

import { Dispatch, SetStateAction, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDarkmode } from '@/hooks/darkmode';
import { Info, ExchangeDealsWithSupported, ExchangeDealWithBestDeal } from '@/routes/buy/types';
import { Bank, BankDark, CreditCard, CreditCardDark } from '@/components/icon';
import { InfoButton } from '@/components/infobutton/infobutton';
import { Badge } from '@/components/badge/badge';
import { getFormattedName } from '@/routes/buy/utils';
import style from './exchangeselectionradio.module.css';

type RadioProps = {
  deals: ExchangeDealsWithSupported['deals'];
  exchangeName: ExchangeDealsWithSupported['exchangeName'];
  onChange: () => void;
  onClickInfoButton: Dispatch<SetStateAction<Info | undefined>>;
}

type TRadioProps = RadioProps & JSX.IntrinsicElements['input'];
type TPaymentMethodProps = { methodName: ExchangeDealWithBestDeal['payment'] };

const PaymentMethod = ({ methodName }: TPaymentMethodProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  switch (methodName) {
  case 'bank-transfer':
    return (
      <span className={style.paymentMethodName}>
        {isDarkMode ? <Bank /> : <BankDark />}
        {t('buy.exchange.bankTransfer')}
      </span>
    );
  case 'card':
    return (
      <span className={style.paymentMethodName}>
        {isDarkMode ? <CreditCard /> : <CreditCardDark />}
        {t('buy.exchange.creditCard')}
      </span>
    );
  default:
    return <>{methodName}</>;
  }
};

const Deal = ({ deal }: { deal: ExchangeDealWithBestDeal }) => {
  const { t } = useTranslation();
  return (
    <div className={style.paymentMethodContainer}>
      <PaymentMethod methodName={deal.payment} />
      <div>
        {deal.isBestDeal && (
          <Badge type="success">{t('buy.exchange.bestDeal')}</Badge>
        )}
        {deal.isFast && (
          <Badge type="warning">{t('buy.exchange.fast')}</Badge>
        )}
      </div>
    </div>
  );
};

export const ExchangeSelectionRadio = ({
  disabled = false,
  id,
  children,
  checked,
  deals,
  onChange,
  exchangeName,
  onClickInfoButton,
  ...props
}: TRadioProps) => {

  const handleClick = () => {
    if (!disabled) {
      onChange();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (!disabled && e.key === 'Enter') {
      onChange();
    }
  };

  return (
    <div className={style.outerContainer}>
      <span aria-checked={checked} onKeyDown={handleKeyDown} aria-disabled={disabled} role="radio" tabIndex={0} onClick={handleClick} className={style.radio}>
        <input
          checked={checked}
          type="radio"
          id={id}
          disabled={disabled}
          onChange={onChange}
          {...props}
        />
        <label className={style.radioLabel} htmlFor={id}>
          <div className={style.container}>
            <p className={[style.text, style.exchangeName].join(' ')}>
              {getFormattedName(exchangeName)}
            </p>
            <div className={style.paymentMethodsContainer}>
              {deals.map(deal => <Deal key={deal.payment} deal={deal}/>)}
            </div>
          </div>
        </label>
      </span>
      <InfoButton onClick={() => onClickInfoButton(exchangeName)} />
    </div>

  );
};
