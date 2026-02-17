// SPDX-License-Identifier: Apache-2.0

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
import { getBTCDirectOTCLink, InfoContent, TInfoContentProps } from './components/infocontent';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { connectKeystore } from '@/api/keystores';
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

  const [selectedAccount, setSelectedAccount] = useState<string>(code);
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

  const [agreedBTCDirectOTCTerms, setAgreedBTCDirectOTCTerms] = useState(false);

  useEffect(() => {
    if (config) {
      setAgreedBTCDirectOTCTerms(config.frontend.skipBTCDirectOTCDisclaimer);
    }
  }, [config]);

  // get the list of accounts supported by vendors, needed to correctly handle back button.
  useEffect(() => {
    getVendorSupportedAccounts(accounts).then(vendorSupportedAccounts => {
      setSupportedAccounts(vendorSupportedAccounts);
      if (!selectedAccount && vendorSupportedAccounts.length > 0) {
        setSelectedAccount(vendorSupportedAccounts[0]?.code || '');
      }
    });
  }, [accounts, selectedAccount]);

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

  const buyDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('buy', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const sellDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('sell', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const spendDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('spend', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  // TODO: do we care about selectedAccount, selectedRegion for OTC?
  const otcDealsResponse = useLoad(marketAPI.getOTCDeals);
  const swapDealsResponse = useLoad(marketAPI.getSwapDeals);

  const handleAccountChange = async (accountCode: string) => {
    const account = supportedAccounts.find(acc => acc.code === accountCode);
    if (!account) {
      return;
    }
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (connectResult.success) {
      setSelectedAccount(accountCode);
    }
  };

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
    case 'swap':
      return swapDealsResponse;
    case 'otc':
      return otcDealsResponse;
    }
  };

  const getServicesLabel = (action: marketAPI.TMarketAction) => {
    switch (action) {
    case 'buy':
      return t('buy.exchange.buyServices');
    case 'sell':
      return t('buy.exchange.sellServices');
    case 'spend':
      return t('buy.exchange.spendServices');
    case 'swap':
      return t('buy.exchange.swapServices');
    }
  };

  const goToVendor = (vendor: string) => {
    if (!vendor) {
      return;
    }
    if (activeTab === 'swap') {
      navigate('/market/swap');
      return;
    }
    if (activeTab === 'otc') {
      navigate(agreedBTCDirectOTCTerms ? getBTCDirectOTCLink() : '/market/btcdirect-otc');
      return;
    }
    if (!selectedAccount) {
      return;
    }
    navigate(`/market/${vendor}/${activeTab}/${selectedAccount}/${selectedRegion}`);
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
          <View width="550px" minHeight="695px" verticallyCentered fullscreen={false}>
            <ViewContent fullWidth>
              <div className={style.exchangeContainer}>
                {regions.length ? (
                  <>
                    <MarketTab
                      onChangeTab={setActiveTab}
                      activeTab={activeTab}
                    />
                    {activeTab !== 'swap' && (
                      <>
                        <label className={style.label}>
                          {t('buy.exchange.region')}
                        </label>

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

                        {activeTab !== 'otc' && (
                          <>
                            <label className={style.label}>
                              {t('account.account')}
                            </label>
                            <div className={style.selectContainer}>
                              <GroupedAccountSelector
                                accounts={supportedAccounts}
                                selected={selectedAccount}
                                onChange={handleAccountChange}
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}

                    <div className={style.radioButtonsContainer}>
                      {(activeTab === 'swap' || !!selectedAccount) && (
                        <label className={style.label}>{getServicesLabel(activeTab)}</label>
                      )}
                      <Deals
                        marketDealsResponse={getDealReponse(activeTab)}
                        goToVendor={goToVendor}
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
