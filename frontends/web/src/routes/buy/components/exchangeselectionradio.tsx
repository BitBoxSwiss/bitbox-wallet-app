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
import { Bank, BankDark, CreditCard, CreditCardDark } from '../../../components/icon';
import { Info, ExchangeDealsWithSupported, ExchangeDealWithBestDeal } from '../types';
import { getFormattedName } from '../utils';
import { BestDeal, Fast } from './buytags';
import { InfoButton } from '../../../components/infobutton/infobutton';
import style from './exchangeselectionradio.module.css';
import { useDarkmode } from '../../../hooks/darkmode';

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
      <span>
        {isDarkMode ? <Bank /> : <BankDark />}
        <p className={style.paymentMethodName}>{t('buy.exchange.bankTransfer')}</p>
      </span>
    );
  case 'card':
    return (
      <span>
        {isDarkMode ? <CreditCard /> : <CreditCardDark />}
        <p className={style.paymentMethodName}>{t('buy.exchange.creditCard')}</p>
      </span>
    );
  default:
    return <>{methodName}</>;
  }
};

const Deal = ({ deal }: { deal: ExchangeDealWithBestDeal }) => {
  return (
    <div className={style.paymentMethodContainer}>
      <PaymentMethod methodName={deal.payment} />
      <div>
        {deal.isBestDeal && <BestDeal />}
        {deal.isFast && <Fast />}
      </div>
    </div>
  );
};

export function ExchangeSelectionRadio({
  disabled = false,
  id,
  children,
  checked,
  deals,
  onChange,
  exchangeName,
  onClickInfoButton,
  ...props
}: TRadioProps) {

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
}