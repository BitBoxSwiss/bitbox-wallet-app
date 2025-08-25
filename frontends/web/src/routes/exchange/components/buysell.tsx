/**
 * Copyright 2024 Shift Crypto AG
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

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import * as exchangesAPI from '@/api/exchanges';
import { Button } from '@/components/forms/button';
import { getBTCDirectOTCLink, TInfoContentProps, TPaymentFee } from './infocontent';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Message } from '@/components/message/message';
import { ExternalLinkWhite, ExternalLinkBlack, Businessman } from '@/components/icon';
import { useDarkmode } from '@/hooks/darkmode';
import { A } from '@/components/anchor/anchor';
import { InfoButton } from '@/components/infobutton/infobutton';
import { getConfig } from '@/utils/config';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { ExchangeProviders } from '@/routes/exchange/components/exchange-providers';
import style from '../exchange.module.css';

type TProps = {
  accountCode: string;
  selectedRegion: string;
  goToExchange: (exchange: string) => void;
  showBackButton: boolean;
  action: exchangesAPI.TExchangeAction;
  setInfo: (info: TInfoContentProps) => void;
}

export const BuySell = ({
  accountCode,
  selectedRegion,
  goToExchange,
  showBackButton,
  action,
  setInfo,
}: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();

  const exchangeDealsResponse = useLoad(() => exchangesAPI.getExchangeDeals(action, accountCode, selectedRegion), [action, selectedRegion]);
  const btcDirectOTCSupported = useLoad(exchangesAPI.getBtcDirectOTCSupported(accountCode, selectedRegion), [selectedRegion]);
  const [agreedBTCDirectOTCTerms, setAgreedBTCDirectOTCTerms] = useState(false);
  const config = useLoad(getConfig);
  const navigate = useNavigate();

  useEffect(() => {
    if (config) {
      setAgreedBTCDirectOTCTerms(config.frontend.skipBTCDirectOTCDisclaimer);
    }
  }, [config]);

  const buildInfo = (exchange: exchangesAPI.ExchangeDeals): TInfoContentProps => {
    let paymentFees: TPaymentFee = {};
    exchange.deals.forEach(deal => paymentFees[deal.payment] = deal.fee);
    return {
      action,
      exchangeName: exchange.exchangeName,
      paymentFees,
    };
  };

  return (
    <>
      <div className={style.innerRadioButtonsContainer}>
        {!exchangeDealsResponse && <Skeleton />}
        {exchangeDealsResponse?.success === false ? (
          <div className="flex flex-column">
            <p className={style.noExchangeText}>
              {exchangeDealsResponse?.success === false && (
                exchangeDealsResponse.errorCode
                  ? t('exchange.buySell.' + exchangeDealsResponse.errorCode)
                  : exchangeDealsResponse.errorMessage
              )}
            </p>
          </div>
        ) : (
          <div className={style.exchangeProvidersContainer}>
            {exchangeDealsResponse?.exchanges
              // skip the exchanges that have only hidden deals.
              .filter(exchange => (exchange.deals.some(deal => !deal.isHidden)))
              .map(exchange => (
                <div key={exchange.exchangeName} className={style.actionableItemContainer}>
                  <ActionableItem
                    key={exchange.exchangeName}
                    onClick={() => {
                      goToExchange(exchange.exchangeName);
                    }}>
                    <ExchangeProviders
                      deals={exchange.deals}
                      exchangeName={exchange.exchangeName}
                    />
                  </ActionableItem>

                  <InfoButton onClick={() => setInfo(buildInfo(exchange))} />
                </div>
              ))}
          </div>
        )}
        {btcDirectOTCSupported?.success && btcDirectOTCSupported?.supported && action !== 'spend' && (
          <div className={style.infoContainer}>
            <Message type="info" icon={<Businessman/>}>
              {t('buy.exchange.infoContent.btcdirect.title')}
              <p>{t('buy.exchange.infoContent.btcdirect.info')}</p>
              <p>
                {!agreedBTCDirectOTCTerms ? (
                  <Link to={'/exchange/btcdirect-otc'} className={style.link}>
                    {t('buy.exchange.infoContent.btcdirect.link')}
                  </Link>
                ) : (
                  <A href={getBTCDirectOTCLink()} className={style.link}>
                    {t('buy.exchange.infoContent.btcdirect.link')}
                  </A>
                )}
                    &nbsp;
                {isDarkMode ? <ExternalLinkWhite className={style.textIcon}/> : <ExternalLinkBlack className={style.textIcon}/>}
              </p>
            </Message>
            <InfoButton onClick={() => setInfo({
              action,
              exchangeName: 'btcdirect-otc',
              paymentFees: {}
            })} />
          </div>
        )}
      </div>
      {exchangeDealsResponse?.success && (
        <div className={style.buttonsContainer}>
          {showBackButton && (
            <Button
              className={style.buttonBack}
              secondary
              onClick={() => navigate('/exchange/info')}>
              {t('button.back')}
            </Button>
          )}
        </div>
      )}
    </>
  );
};
