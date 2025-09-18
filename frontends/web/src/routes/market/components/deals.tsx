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
import * as marketAPI from '@/api/market';
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
import { VendorDeals } from '@/routes/market/components/vendor-deals';
import style from '../market.module.css';

type TProps = {
  marketDealsResponse: marketAPI.TMarketDealsResponse | undefined;
  btcDirectOTCSupported: marketAPI.TBtcDirectResponse | undefined;
  goToVendor: (vendor: string) => void;
  showBackButton: boolean;
  action: marketAPI.TMarketAction;
  setInfo: (info: TInfoContentProps) => void;
}

export const Deals = ({
  marketDealsResponse,
  btcDirectOTCSupported,
  goToVendor,
  showBackButton,
  action,
  setInfo,
}: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();

  const [agreedBTCDirectOTCTerms, setAgreedBTCDirectOTCTerms] = useState(false);
  const config = useLoad(getConfig);
  const navigate = useNavigate();

  useEffect(() => {
    if (config) {
      setAgreedBTCDirectOTCTerms(config.frontend.skipBTCDirectOTCDisclaimer);
    }
  }, [config]);

  const buildInfo = (marketDeals: marketAPI.TMarketDeals): TInfoContentProps => {
    let paymentFees: TPaymentFee = {};
    marketDeals.deals.forEach(deal => deal.payment && (paymentFees[deal.payment] = deal.fee));
    return {
      action,
      vendorName: marketDeals.vendorName,
      paymentFees,
    };
  };

  return (
    <>
      <div className={style.innerRadioButtonsContainer}>
        {!marketDealsResponse && <Skeleton />}
        {marketDealsResponse?.success === false ? (
          <div className="flex flex-column">
            <p className={style.noExchangeText}>
              {marketDealsResponse?.success === false && (
                marketDealsResponse.errorCode
                  ? t('exchange.buySell.' + marketDealsResponse.errorCode)
                  : marketDealsResponse.errorMessage
              )}
            </p>
          </div>
        ) : (
          <div className={style.exchangeProvidersContainer}>
            {marketDealsResponse?.deals
              // skip the vendors that have only hidden deals.
              .filter(vendor => (vendor.deals.some(deal => !deal.isHidden)))
              .map(vendor => (
                <div key={vendor.vendorName} className={style.actionableItemContainer}>
                  <ActionableItem
                    key={vendor.vendorName}
                    onClick={() => {
                      goToVendor(vendor.vendorName);
                    }}>
                    <VendorDeals
                      deals={vendor.deals}
                      vendorName={vendor.vendorName}
                    />
                  </ActionableItem>

                  <InfoButton onClick={() => setInfo(buildInfo(vendor))} />
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
                  <Link to={'/market/btcdirect-otc'} className={style.link}>
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
              vendorName: 'btcdirect-otc',
              paymentFees: {}
            })} />
          </div>
        )}
      </div>
      {marketDealsResponse?.success && (
        <div className={style.buttonsContainer}>
          {showBackButton && (
            <Button
              className={style.buttonBack}
              secondary
              onClick={() => navigate('/market/info')}>
              {t('button.back')}
            </Button>
          )}
        </div>
      )}
    </>
  );
};
