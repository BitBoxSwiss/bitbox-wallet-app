/**
 * Copyright 2022-2025 Shift Crypto AG
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
import { useDarkmode } from '@/hooks/darkmode';
import { Bank, BankDark, CreditCard, CreditCardDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { getExchangeFormattedName } from '@/routes/exchange/utils';
import { ExchangeDeal, ExchangeDeals } from '@/api/exchanges';
import style from './exchange-provider.module.css';

type Props = {
  deals: ExchangeDeal[];
  exchangeName: ExchangeDeals['exchangeName'];
}

type TDealProps = {
  deal: ExchangeDeal;
  exchangeName: ExchangeDeals['exchangeName'];
};

type TPaymentMethodProps = {
  methodName: ExchangeDeal['payment'];
  exchangeName: ExchangeDeals['exchangeName'];
};

const PaymentMethod = ({
  methodName,
  exchangeName
}: TPaymentMethodProps) => {
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
  case 'spend':
    return (
      <span className={style.paymentMethodName}>
        {t('buy.exchange.spend', { context: exchangeName })}
      </span>
    );
  case 'sofort':
  case 'bancontact':
  default:
    return <>{methodName}</>;
  }
};

const Deal = ({
  deal,
  exchangeName
}: TDealProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.paymentMethodContainer}>
      <PaymentMethod methodName={deal.payment} exchangeName={exchangeName}/>
      <div className={style.badgeContainer}>
        {deal.isBest && (
          <Badge type="success">{t('buy.exchange.bestDeal')}</Badge>
        )}
        {deal.isFast && (
          <Badge type="warning">{t('buy.exchange.fast')}</Badge>
        )}
      </div>
    </div>
  );
};


export const ExchangeProviders = ({
  deals,
  exchangeName,
}: Props) => {
  return (
    <div className={style.exchangeContainer}>
      <div className={style.container}>
        <p className={[style.text, style.exchangeName].join(' ')}>
          {getExchangeFormattedName(exchangeName)}
        </p>
        <div className={style.paymentMethodsContainer}>
          {deals.map(deal => !deal.isHidden && <Deal key={deal.payment} deal={deal} exchangeName={exchangeName}/>)}
        </div>
      </div>
    </div>
  );
};
