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
import * as marketAPI from '@/api/market';
import { AccountCode, TAccount } from '@/api/account';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { MarketGuide } from './guide';
import { isBitcoinOnly } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { getRegionNameFromLocale } from '@/i18n/utils';
import { getVendorFormattedName, getVendorSupportedAccounts } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { InfoButton } from '@/components/infobutton/infobutton';
import { MarketTab } from './components/markettab';
import { Deals } from './components/deals';
import { getNativeLocale } from '@/api/nativelocale';
import { getConfig, setConfig } from '@/utils/config';
import { CountrySelect, TOption } from './components/countryselect';
import { InfoContent, TInfoContentProps } from './components/infocontent';
import style from './market.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
};

export const Market = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regions, setRegions] = useState<TOption[]>([]);
  const [info, setInfo] = useState<TInfoContentProps>();
  const [supportedAccounts, setSupportedAccounts] = useState<TAccount[]>([]);
  const [activeTab, setActiveTab] = useState<marketAPI.TMarketAction>('buy');

  const regionCodes = useLoad(marketAPI.getMarketRegionCodes);
  const nativeLocale = useLoad(getNativeLocale);
  const config = useLoad(getConfig);

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('generic.buySell');

  // get the list of accounts supported by vendors, needed to correctly handle back button.
  useEffect(() => {
    getVendorSupportedAccounts(accounts).then(setSupportedAccounts);
  }, [accounts]);

  // update region Select component when `regionList` or `config` gets populated.
  useEffect(() => {
    if (!regionCodes || !config) {
      return;
    }
    const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
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

  const buyDealsResponse = useLoad(() => marketAPI.getMarketDeals('buy', code, selectedRegion), [code, selectedRegion]);
  const sellDealsResponse = useLoad(() => marketAPI.getMarketDeals('sell', code, selectedRegion), [code, selectedRegion]);
  const spendDealsResponse = useLoad(() => marketAPI.getMarketDeals('spend', code, selectedRegion), [code, selectedRegion]);
  const btcDirectOTCSupported = useLoad(marketAPI.getBtcDirectOTCSupported(code, selectedRegion), [code, selectedRegion]);

  // catch edge to change to spend tab for regions that dont have any buy or sell offerings
  useEffect(() => {
    const noBuy = buyDealsResponse !== undefined && (!buyDealsResponse.success || buyDealsResponse.deals.length === 0);
    const noSell = sellDealsResponse !== undefined && (!sellDealsResponse?.success || sellDealsResponse.deals.length === 0);
    const hasSpend = spendDealsResponse?.success && spendDealsResponse.deals.length > 0;
    if (noBuy && noSell && hasSpend) {
      setActiveTab('spend');
    }
  }, [
    selectedRegion, // react to region changes
    buyDealsResponse, sellDealsResponse, spendDealsResponse
  ]);

  const getDealReponse = (action: marketAPI.TMarketAction) => {
    switch (action) {
    case 'buy':
      return buyDealsResponse;
    case 'sell':
      return sellDealsResponse;
    case 'spend':
      return spendDealsResponse;
    }
  };

  const goToVendor = (vendor: string) => {
    if (!vendor) {
      return;
    }
    navigate(`/market/${vendor}/${activeTab}/${code}/${selectedRegion}`);
  };

  const handleChangeRegion = (newValue: SingleValue<TOption>) => {
    if (newValue) {
      const selectedRegion = newValue.value;
      setSelectedRegion(selectedRegion);
      setConfig({ frontend: { selectedExchangeRegion: selectedRegion } });
    }
  };

  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Dialog
            medium
            title={info && info.vendorName !== 'region' ? getVendorFormattedName(info.vendorName) : t('buy.exchange.region')}
            onClose={() => setInfo(undefined)}
            open={!!info}
          >
            {info && (
              <InfoContent
                action={info.action}
                accounts={accounts}
                vendorName={info.vendorName}
                paymentFees={info.paymentFees}
              />
            )}
          </Dialog>
          <Header title={
            <h2>
              {activeTab === 'spend' ? (
                t('generic.spend', { context: translationContext })
              ) : title}
            </h2>
          } />
          <View width="550px" verticallyCentered fitContent fullscreen={false}>
            <ViewContent fullWidth>
              <div className={style.exchangeContainer}>
                <p className={style.label}>
                  {t('buy.exchange.region')}
                </p>
                {regions.length ? (
                  <>
                    <div className={style.selectContainer}>
                      <CountrySelect
                        onChangeRegion={handleChangeRegion}
                        regions={regions}
                        selectedRegion={selectedRegion}
                      />
                      <InfoButton onClick={() => setInfo({
                        action: activeTab,
                        vendorName: 'region',
                        paymentFees: {}
                      })} />
                    </div>
                    <MarketTab
                      onChangeTab={setActiveTab}
                      activeTab={activeTab}
                    />
                    <div className={style.radioButtonsContainer}>
                      <Deals
                        marketDealsResponse={getDealReponse(activeTab)}
                        btcDirectOTCSupported={btcDirectOTCSupported}
                        goToVendor={goToVendor}
                        showBackButton={supportedAccounts.length > 1}
                        action={activeTab}
                        setInfo={setInfo}
                      />
                    </div>
                  </>
                ) : <Spinner />}
              </div>
            </ViewContent>
          </View>
        </GuidedContent>
        <MarketGuide translationContext={translationContext} />
      </GuideWrapper>
    </Main>
  );
};
