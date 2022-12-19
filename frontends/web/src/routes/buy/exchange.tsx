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
import { Button, Select, Radio } from '../../components/forms';
import * as exchangesAPI from '../../api/exchanges';
import { IAccount } from '../../api/account';
import { Header } from '../../components/layout';
import Guide from './guide';
import { findAccount, getCryptoName } from '../account/utils';
import { route } from '../../utils/route';
import { useLoad } from '../../hooks/api';
import { languageFromConfig, localeMainLanguage } from '../../i18n/config';
import style from './exchange.module.css';

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
  const [bestDeal, setBestDeal] = useState<exchangesAPI.ExchangeDeal>();

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

  const findBestDeal = (deals: exchangesAPI.ExchangeDeal[]): exchangesAPI.ExchangeDeal => {
    let best = deals[0];
    deals.forEach(deal => best = deal.fee < best.fee ? deal : best);
    return best;
  };

  // set the bestDeal when getExchangeDeals returns.
  useEffect(() => {
    if (!exchangeDeals) {
      return;
    }
    const pocketBest = findBestDeal(exchangeDeals.exchanges[0].deals);
    const moonpayBest = findBestDeal(exchangeDeals.exchanges[1].deals);
    setBestDeal(findBestDeal([pocketBest, moonpayBest]));
  }, [exchangeDeals]);

  const dealsDetails = (exchange: string): string => {
    if (!exchangeDeals) {
      return '';
    }
    var details = exchange === 'pocket' ? 'Pocket' : 'Moonpay';
    const deals = exchange === 'pocket' ? exchangeDeals.exchanges[0].deals : exchangeDeals.exchanges[1].deals;
    deals.forEach(deal => {
      details += ' | ';
      details += deal.payment === 'card' ? t('buy.exchange.creditCard') : t('buy.exchange.bankTransfer');
      details += ' - ' + t('buy.exchange.fee') + ': ';
      details += String(deal.fee * 100) + '%';
      if (deal === bestDeal && showPocket && showMoonpay) {
        details += ' - ';
        //TODO replace with icon
        details += 'BEST DEAL';
      }
      if (deal.isFast) {
        details += ' - ';
        //TODO replace with icon
        details += 'FAST';
      }
    });
    return details;
  };

  const goToExchange = () => {
    if (!selectedExchange) {
      return;
    }
    route(`/buy/${selectedExchange}/${code}`);
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={<h2>{t('buy.exchange.title', { name })}</h2>} />
        </div>
        <div className="innerContainer">
          {t('buy.exchange.region')}
          <div>
            { regions.length ? (
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
            ) : ('')}
          </div>
          <div>
            { !showMoonpay && !showPocket && (
              t('buy.exchange.noExchanges')
            )}
          </div>
          <div>
            { showMoonpay && (<Radio
              disabled={!selectedRegion}
              id="moonpay"
              checked={ selectedExchange === 'moonpay' }
              onChange={() => setSelectedExchange('moonpay')} >
              {dealsDetails('moonpay')}

            </Radio>) }
          </div>
          <div>
            { showPocket && (<Radio
              disabled={!selectedRegion}
              id="pocket"
              checked={ selectedExchange === 'pocket' }
              onChange={() => setSelectedExchange('pocket')} >
              {dealsDetails('pocket')}
            </Radio>) }
          </div>
          <div>
            <Button
              primary
              disabled={!selectedExchange}
              onClick={goToExchange} >
          Next
            </Button>
          </div>
        </div>
      </div>
      <Guide name={name} />
    </div>

  );
};
