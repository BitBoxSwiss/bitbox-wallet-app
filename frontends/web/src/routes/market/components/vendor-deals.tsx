// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useDarkmode } from '@/hooks/darkmode';
import { Bank, BankDark, CreditCard, CreditCardDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { getVendorFormattedName } from '@/routes/market/utils';
import { TMarketOffer, TOfferVendor } from '@/api/market';
import style from './vendor-deals.module.css';

type Props = {
  offers: TMarketOffer[];
  vendorName: TOfferVendor['vendorName'];
};

type TDealProps = {
  offer: TMarketOffer;
  vendorName: TOfferVendor['vendorName'];
};

type TPaymentMethodProps = {
  methodName: TMarketOffer['payment'];
};

const PaymentMethod = ({
  methodName,
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
  case 'sofort':
  case 'bancontact':
  default:
    return <>{methodName}</>;
  }
};

const Deal = ({
  offer,
  vendorName
}: TDealProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.paymentMethodContainer}>
      {offer.payment ? (
        <PaymentMethod methodName={offer.payment}/>
      ) : (
        <span className={style.dealDescription}>
          {t('buy.exchange.description', { context: vendorName })}
        </span>
      )}
      <div className={style.badgeContainer}>
        {offer.isBest && (
          <Badge type="success">{t('buy.exchange.bestDeal')}</Badge>
        )}
        {offer.isFast && (
          <Badge type="warning">{t('buy.exchange.fast')}</Badge>
        )}
      </div>
    </div>
  );
};


export const VendorDeals = ({
  offers,
  vendorName,
}: Props) => {
  return (
    <div className={style.exchangeContainer}>
      <div className={style.container}>
        <h3 className={style.exchangeName}>
          {getVendorFormattedName(vendorName)}
        </h3>
        <div className={style.paymentMethodsContainer}>
          {offers.map(offer => !offer.isHidden && (
            <Deal
              key={`${vendorName || ''}_${offer.payment || ''}`}
              offer={offer}
              vendorName={vendorName}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
