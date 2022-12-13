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

import { useTranslation } from 'react-i18next';
import { ExchangeDeals } from '../../../api/exchanges';
import { ExchangeDealsWithSupported, ExchangeDealWithBestDeal } from '../types';
import style from './exchangeselectionradio.module.css';

type RadioProps = {
  deals: ExchangeDealsWithSupported['deals'];
  exchangeName: ExchangeDealsWithSupported['exchangeName'];
  onChange: () => void;
}

type TRadioProps = RadioProps & JSX.IntrinsicElements['input'];

const Deal = ({ deal }: { deal: ExchangeDealWithBestDeal }) => {
  const { t } = useTranslation();
  const getPaymentMethodName = (methodName: ExchangeDeals['exchangeName']) => {
    switch (methodName) {
    case 'bank-transfer':
      return t('buy.exchange.bankTransfer');
    case 'card':
      return t('buy.exchange.creditCard');
    default:
      return methodName;
    }
  };
  return (
    <div className={style.paymentMethodContainer}>
      <p className={style.paymentMethodName}>{getPaymentMethodName(deal.payment)}</p>
      <div>
        <span>{deal.isBestDeal && t('buy.exchange.bestDeal')}</span>
        <span>{deal.isFast && t('buy.exchange.fast')}</span>
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
  ...props
}: TRadioProps) {

  const getExchangeName = (name: string) => {
    switch (name) {
    case 'moonpay':
      return 'MoonPay';
    case 'pocket':
      return 'Pocket';
    }
  };

  return (
    <span aria-checked={checked} aria-disabled={disabled} role={'radio'} onClick={() => {
      if (!disabled) {
        onChange();
      }
    }} className={style.radio}>
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
            {getExchangeName(exchangeName)}
          </p>
          <div className={style.paymentMethodsContainer}>
            {deals.map(deal => <Deal key={deal.payment} deal={deal}/>)}
          </div>
        </div>
      </label>
    </span>
  );
}
