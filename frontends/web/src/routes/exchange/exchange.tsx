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

import 'flag-icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SingleValue } from 'react-select';
import { i18n } from '@/i18n/i18n';
import * as exchangesAPI from '@/api/exchanges';
import { AccountCode, IAccount } from '@/api/account';
import { Header } from '@/components/layout';
import { ExchangeGuide } from './guide';
import { isBitcoinOnly } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { getRegionNameFromLocale } from '@/i18n/utils';
import { getExchangeFormattedName, getExchangeSupportedAccounts } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { InfoButton } from '@/components/infobutton/infobutton';
import { ExchangeTab } from './components/exchangetab';
import { BuySell } from './components/buysell';
import { getNativeLocale } from '@/api/nativelocale';
import { getConfig, setConfig } from '@/utils/config';
import { CountrySelect, TOption } from './components/countryselect';
import { InfoContent, TInfoContentProps } from './components/infocontent';
import style from './exchange.module.css';

type TProps = {
    accounts: IAccount[];
    code: AccountCode;
    deviceIDs: string[];
}

export const Exchange = ({ code, accounts, deviceIDs }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regions, setRegions] = useState<TOption[]>([]);
  const [info, setInfo] = useState<TInfoContentProps>();
  const [supportedAccounts, setSupportedAccounts] = useState<IAccount[]>([]);
  const [activeTab, setActiveTab] = useState<exchangesAPI.TExchangeAction>('buy');

  const regionCodes = useLoad(exchangesAPI.getExchangeRegionCodes);
  const nativeLocale = useLoad(getNativeLocale);
  const config = useLoad(getConfig);

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('generic.buySell');

  // get the list of accounts supported by exchanges, needed to correctly handle back button.
  useEffect(() => {
    getExchangeSupportedAccounts(accounts).then(setSupportedAccounts);
  }, [accounts]);

  // update region Select component when `regionList` or `config` gets populated.
  useEffect(() => {
    if (!regionCodes || !config) {
      return;
    }
    const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' }) || '';
    const regions: TOption[] = regionCodes.map(code => ({
      value: code,
      label: regionNames.of(code) || code
    }));

    regions.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    setRegions(regions);

    // if user had selected no region before, do not pre-select any.
    if (config.frontend.selectedExchangeRegion === '') {
      return;
    }

    if (config.frontend.selectedExchangeRegion) {
      // pre-select config region
      setSelectedRegion(config.frontend.selectedExchangeRegion);
      return;
    }

    // user never selected a region preference, will derive it from native locale.
    const userRegion = getRegionNameFromLocale(nativeLocale || '');
    //Region is available in the list
    const regionAvailable = !!(regionCodes.find(code => code === userRegion));
    //Pre-selecting the region
    setSelectedRegion(regionAvailable ? userRegion : '');
  }, [regionCodes, config, nativeLocale]);


  const goToExchange = (exchange: string) => {
    if (!exchange) {
      return;
    }
    navigate(`/exchange/${exchange}/${activeTab}/${code}`);
  };

  const handleChangeRegion = (newValue: SingleValue<TOption>) => {
    if (newValue) {
      const selectedRegion = newValue.value;
      setSelectedRegion(selectedRegion);
      setConfig({ frontend: { selectedExchangeRegion: selectedRegion } });
    }
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <Dialog
          medium
          title={info && info.exchangeName !== 'region' ? getExchangeFormattedName(info.exchangeName) : t('buy.exchange.region')}
          onClose={() => setInfo(undefined)}
          open={!!info}
        >
          {info && (
            <InfoContent
              accounts={accounts}
              exchangeName={info.exchangeName}
              paymentFees={info.paymentFees}
            />
          )}
        </Dialog>
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{title}</h2>} />
          <div className={[style.exchangeContainer, 'content', 'narrow', 'isVerticallyCentered'].join(' ')}>
            <p className={style.label}>{t('buy.exchange.region')}</p>
            {regions.length ? (
              <>
                <div className={style.selectContainer}>
                  <CountrySelect
                    onChangeRegion={handleChangeRegion}
                    regions={regions}
                    selectedRegion={selectedRegion}
                  />
                  <InfoButton onClick={() => setInfo({ exchangeName: 'region', paymentFees: {} })} />
                </div>
                <ExchangeTab
                  onChangeTab={(tab) => {
                    setActiveTab(tab);
                  }}
                  activeTab={activeTab}
                />
                <div className={style.radioButtonsContainer}>
                  <BuySell
                    accountCode={code}
                    selectedRegion={selectedRegion}
                    deviceIDs={deviceIDs}
                    goToExchange={goToExchange}
                    showBackButton={supportedAccounts.length > 1}
                    action={activeTab}
                    setInfo={setInfo}
                  />
                </div>
              </>
            ) : <Spinner />}
          </div>
        </div>
      </div>
      <ExchangeGuide translationContext={hasOnlyBTCAccounts ? 'bitcoin' : 'crypto'} />
    </div>
  );
};
