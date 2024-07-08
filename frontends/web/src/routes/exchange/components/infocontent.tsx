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
import { A } from '@/components/anchor/anchor';
import { Info } from '@/routes/exchange/types';
import style from './infocontent.module.css';

type TInfoContentProps = {info: Info, cardFee?: number, bankTransferFee?: number};
type TMoonPayInfo = {cardFee?: number, bankTransferFee?: number};
type TPocketInfo = { bankTransferFee?: number };

export const MoonPayInfo = ({ cardFee, bankTransferFee }: TMoonPayInfo) => {
  const { t } = useTranslation();
  const formattedCardFee = cardFee && cardFee * 100;
  const formattedBankTransferFee = bankTransferFee && bankTransferFee * 100;
  return (
    <div className={style.container}>
      <p>{t('buy.exchange.infoContent.moonpay.supportedCurrencies')}</p>
      <br />
      <p><A href="https://support.moonpay.com/hc/en-gb/articles/360011931457-Which-fiat-currencies-are-supported-">{t('buy.exchange.infoContent.moonpay.fullCurrenciesList')}</A></p>
      <br />
      <p><b>{t('buy.exchange.infoContent.moonpay.payment.title')}</b></p>
      <br />
      <p>{t('buy.exchange.infoContent.moonpay.payment.creditDebitCard')}</p>
      <ul>
        <li>{t('buy.exchange.infoContent.moonpay.payment.creditDebitCardDetails.cards')}</li>
      </ul>
      <p>{t('buy.exchange.infoContent.moonpay.payment.bankTransfer')}</p>
      <ul>
        <li>{t('buy.exchange.infoContent.moonpay.payment.bankTransferDetails.sepa')}</li>
        <li>{t('buy.exchange.infoContent.moonpay.payment.bankTransferDetails.uk')}</li>
        <li>{t('buy.exchange.infoContent.moonpay.payment.bankTransferDetails.pix')}</li>
      </ul>
      <br/>
      <p><i>{t('buy.exchange.infoContent.moonpay.payment.asteriskText')}</i></p>
      <br />
      <p><A href="https://support.moonpay.com/hc/en-gb/articles/4406210084113-What-payment-methods-do-you-support-">{t('buy.exchange.infoContent.moonpay.payment.learnMore')}</A></p>
      <br />
      <p><b>{t('buy.exchange.infoContent.moonpay.fees.title')}</b></p>
      <ul>
        <li>{t('buy.exchange.infoContent.moonpay.fees.creditDebitCard', { fee: formattedCardFee })}</li>
        <li>{t('buy.exchange.infoContent.moonpay.fees.bankTransfer', { fee: formattedBankTransferFee })}</li>
      </ul>
      <br />
      <p><A href="https://www.moonpay.com/">{t('buy.exchange.infoContent.moonpay.fees.learnMore')}</A></p>
    </div>
  );
};

export const PocketInfo = ({ bankTransferFee }: TPocketInfo) => {
  const { t } = useTranslation();
  const fee = bankTransferFee && bankTransferFee * 100;
  return (
    <div className={style.container}>
      <p>{t('buy.exchange.infoContent.pocket.supportedCurrencies')}</p>
      <br />
      <p><b>{t('buy.exchange.infoContent.pocket.payment.title')}</b></p>
      <br />
      <p>{t('buy.exchange.infoContent.pocket.payment.bankTransfer')}</p>
      <ul>
        <li>{t('buy.exchange.infoContent.pocket.payment.bankTransferDetails.sepa')}</li>
        <li>{t('buy.exchange.infoContent.pocket.payment.bankTransferDetails.uk')}</li>
        <li>{t('buy.exchange.infoContent.pocket.payment.bankTransferDetails.sic')}</li>
      </ul>
      <br/>
      <p>
        <A href="https://pocketbitcoin.com/faq/how-do-I-set-up-my-standing-order">
          {t('buy.exchange.infoContent.pocket.payment.bankTransferReccuring')}
        </A>
      </p>
      <br />
      <p><b>{t('buy.exchange.infoContent.pocket.verification.title')}</b></p>
      <br />
      <p>{t('buy.exchange.infoContent.pocket.verification.info')}</p>
      <br />
      <p>
        <A href="https://pocketbitcoin.com/faq/are-there-any-limits-with-pocket">
          {t('buy.exchange.infoContent.pocket.verification.link')}
        </A>
      </p>
      <br />
      <p><b>{t('buy.exchange.infoContent.pocket.fees.title')}</b></p>
      <ul>
        <li>{t('buy.exchange.infoContent.pocket.fees.info', { fee })}</li>
      </ul>
      <br />
      <p>
        <A href="https://pocketbitcoin.com/">
          {t('buy.exchange.infoContent.pocket.learnMore')}
        </A>
      </p>
    </div>
  );
};

const RegionInfo = () => {
  const { t } = useTranslation();
  return (
    <div>
      <p>{t('buy.exchange.infoContent.region.title')}</p>
    </div>
  );
};


export const InfoContent = ({ info, cardFee, bankTransferFee }: TInfoContentProps) => {
  switch (info) {
  case 'moonpay':
    return <MoonPayInfo cardFee={cardFee} bankTransferFee={bankTransferFee} />;
  case 'pocket':
    return <PocketInfo bankTransferFee={bankTransferFee} />;
  case 'region':
    return <RegionInfo />;
  }
  return <></>;
};
