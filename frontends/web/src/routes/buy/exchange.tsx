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
import React, { useState, useEffect } from 'react';
import { Button, Select, ButtonLink } from '../../components/forms';
import * as exchangesAPI from '../../api/exchanges';
import { IAccount } from '../../api/account';
import { Header } from '../../components/layout';
import Guide from './guide';
import { findAccount, getCryptoName } from '../account/utils';
import { route } from '../../utils/route';
import { useLoad } from '../../hooks/api';
import { languageFromConfig, localeMainLanguage } from '../../i18n/config';
import { findLowestFee, findBestDeal as findBestD } from './utils';
import { ExchangeSelectionRadio } from './components/exchangeselectionradio';
import { Spinner } from '../../components/spinner/Spinner';
import style from './exchange.module.css';
import { FrontendExchangeDealsList } from './types';

type TProps = {
    code: string;
    accounts: IAccount[];

}

type TOption = {
    text: string;
    value?: string;
}

// TODO:
// - add layout
export const Exchange = ({ code, accounts }: TProps) => {
  const { t } = useTranslation();

  const [showPocket, setShowPocket] = useState(false);
  const [showMoonpay, setShowMoonpay] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('');
  const [regions, setRegions] = useState<TOption[]>([]);
  const [locale, setLocale] = useState('');
  const [allExchangeDeals, setAllExchanges] = useState<FrontendExchangeDealsList>();

  const regionList = useLoad(exchangesAPI.getExchangesByRegion(code));
  const exchangeDeals = useLoad(exchangesAPI.getExchangeDeals);
  const supportedExchanges = useLoad<exchangesAPI.SupportedExchanges>(exchangesAPI.getExchangeBuySupported(code));

  const account = findAccount(accounts, code);
  const name = getCryptoName(t('buy.info.crypto'), account);

  // link locale detection to regionList to having it happen only once page load.
  // can't use `useLoad` because `detect` function returns void.
  useEffect(() => {
    languageFromConfig.detect((locale: string) => setLocale(localeMainLanguage(locale)));
  }, [regionList]);

  // update region Select component when `regionList` or `locale` gets populated.
  useEffect(() => {
    if (!regionList || !locale) {
      return;
    }
    const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
    const regions = regionList.regions.map(region => ({ value: region.code, text: regionNames.of(region.code) } as TOption));
    regions.sort((a, b) => a.text.localeCompare(b.text, locale));
    setRegions(regions);
  }, [regionList, locale]);

  useEffect(() => {
    if (!exchangeDeals) {
      return;
    }

    const deals = { exchanges: exchangeDeals.exchanges.map(ex => ({ ...ex, supported: ex.exchangeName === 'pocket' ? showPocket : showMoonpay })) };

    const lowestFee = findLowestFee(deals);
    const exchangesWithBestDeal = findBestD(deals, lowestFee);

    setAllExchanges(exchangesWithBestDeal);
  }, [selectedRegion, showMoonpay, showPocket, exchangeDeals]);


  // update exchange list when:
  // - pocket/moonpay supported async calls return
  // - new region has been selected
  // - regionList gets populated
  useEffect(() => {
    setSelectedExchange('');

    if (!supportedExchanges) {
      setShowPocket(false);
      setShowMoonpay(false);
      return;
    }

    if (selectedRegion === '') {
      setShowPocket(supportedExchanges.exchanges.includes('pocket'));
      setShowMoonpay(supportedExchanges.exchanges.includes('moonpay'));
      return;
    }

    if (!regionList) {
      return;
    }

    setShowPocket(false);
    setShowMoonpay(false);
    regionList.regions.forEach(region => {
      if (region.code === selectedRegion) {
        setShowPocket(region.isPocketEnabled);
        setShowMoonpay(region.isMoonpayEnabled);
        return;
      }
    });

  }, [selectedRegion, regionList, supportedExchanges]);

  const goToExchange = () => {
    if (!selectedExchange) {
      return;
    }
    route(`/buy/${selectedExchange}/${code}`);
  };

  const noExchangeAvailable = !showMoonpay && !showPocket;

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={<h2>{t('buy.exchange.title', { name })}</h2>} />
        </div>
        <div className="innerContainer">
          <div className={[style.exchangeContainer, 'content', 'narrow'].join(' ')}>
            <h1 className={style.title}>{t('buy.title', { name })}</h1>
            <p className={style.label}>{t('buy.exchange.region')}</p>
            {regions.length ? (
              <>
                <Select
                  options={[{
                    text: t('buy.exchange.selectRegion'),
                    value: '',
                  },
                  ...regions]
                  }
                  onChange={(e: React.SyntheticEvent) => setSelectedRegion((e.target as HTMLSelectElement).value)}
                  id="exchangeRegions"
                />

                <div>
                  {noExchangeAvailable && (
                    <p className={style.noExchangeText}>{t('buy.exchange.noExchanges')}</p>
                  )}

                  <div>
                    {!noExchangeAvailable && allExchangeDeals && allExchangeDeals.exchanges.map(exchange => exchange.supported && (<ExchangeSelectionRadio
                      key={exchange.exchangeName}
                      disabled={!selectedRegion}
                      id={exchange.exchangeName}
                      exchangeName={exchange.exchangeName}
                      deals={exchange.deals}
                      checked={selectedExchange === exchange.exchangeName}
                      onChange={() => setSelectedExchange(exchange.exchangeName)} />
                    ))}
                  </div>

                  {!noExchangeAvailable && <div className={style.buttonsContainer}>
                    <ButtonLink
                      className={style.buttonBack}
                      secondary
                      to={'/buy/info'}>
                      {t('button.back')}
                    </ButtonLink>
                    <Button
                      primary
                      disabled={!selectedExchange}
                      onClick={goToExchange} >
                      {t('button.next')}
                    </Button>
                  </div>}
                </div>
              </>
            ) : <Spinner/>}
          </div>
        </div>
      </div>
      <Guide name={name} />
    </div>
  );
};
