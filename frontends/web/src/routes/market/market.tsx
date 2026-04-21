// SPDX-License-Identifier: Apache-2.0

import 'flag-icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SingleValue } from 'react-select';
import { i18n } from '@/i18n/i18n';
import * as marketAPI from '@/api/market';
import { getSwapStatus } from '@/api/swap';
import { AccountCode, TAccount } from '@/api/account';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { MarketGuide } from './guide';
import { isBitcoinOnly } from '@/routes/account/utils';
import { useLoad } from '@/hooks/api';
import { getRegionNameFromLocale } from '@/i18n/utils';
import { getVendorFormattedName } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { alertUser } from '@/components/alert/Alert';
import { InfoButton } from '@/components/infobutton/infobutton';
import { MarketTab } from './components/markettab';
import { Deals } from './components/deals';
import { getNativeLocale } from '@/api/nativelocale';
import { getConfig, setConfig } from '@/utils/config';
import { CountrySelect, TOption } from './components/countryselect';
import { getBTCDirectOTCLink, InfoContent, TInfoContentProps } from './components/infocontent';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { open } from '@/api/system';
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
  const [pendingSwapNavigation, setPendingSwapNavigation] = useState(false);

  const regionCodes = useLoad(marketAPI.getMarketRegionCodes);
  const nativeLocale = useLoad(getNativeLocale);
  const config = useLoad(getConfig);
  const swapStatus = useLoad(getSwapStatus, [accounts]);

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('generic.buySell');

  const [agreedBTCDirectOTCTerms, setAgreedBTCDirectOTCTerms] = useState(false);

  // sync the OTC disclaimer state from persisted frontend config.
  useEffect(() => {
    if (config) {
      setAgreedBTCDirectOTCTerms(config.frontend.skipBTCDirectOTCDisclaimer);
    }
  }, [config]);

  // finish pending swap navigation after a keystore connection attempt resolves.
  useEffect(() => {
    if (!pendingSwapNavigation) {
      return;
    }
    if (swapStatus?.connectedKeystore === 'multi') {
      setPendingSwapNavigation(false);
      navigate('/market/swap');
      return;
    }
    if (swapStatus?.connectedKeystore === 'btc-only') {
      setPendingSwapNavigation(false);
      alertUser(t('connectKeystore.swapHint'));
    }
  }, [navigate, pendingSwapNavigation, swapStatus, t]);

  // keep account list in sync and ensure a valid selected account.
  useEffect(() => {
    setSupportedAccounts(accounts);
    if (!selectedAccount || !accounts.some(account => account.code === selectedAccount)) {
      setSelectedAccount(accounts[0]?.code || '');
    }
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

  const marketCatalogResponse = useLoad(
    selectedAccount ? () => marketAPI.getMarketCatalog(selectedAccount, selectedRegion) : null,
    [selectedAccount, selectedRegion]
  );

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
    if (!marketCatalogResponse?.success) {
      return;
    }
    const { buy, sell, spend } = marketCatalogResponse.catalog;
    const noBuy = !buy.success
      || ((buy.offerVendors?.length || 0) === 0 && (buy.services?.length || 0) === 0);
    const noSell = !sell.success
      || ((sell.offerVendors?.length || 0) === 0 && (sell.services?.length || 0) === 0);
    const hasSpend = spend.success
      && ((spend.offerVendors?.length || 0) > 0 || (spend.services?.length || 0) > 0);
    if (noBuy && noSell && hasSpend) {
      setActiveTab('spend');
    }
  }, [
    selectedRegion, // react to region changes
    marketCatalogResponse
  ]);

  const getActionSection = (action: marketAPI.TMarketAction) => {
    if (!marketCatalogResponse?.success) {
      return undefined;
    }
    return marketCatalogResponse.catalog[action];
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
    case 'otc':
      return 'OTC';
    }
  };

  const goToVendor = async (vendor: string) => {
    if (!vendor) {
      return;
    }
    if (activeTab === 'swap') {
      if (swapStatus?.connectedKeystore === 'multi') {
        navigate('/market/swap');
        return;
      }
      const connectResult = await connectAnyKeystore();
      if (connectResult.success) {
        setPendingSwapNavigation(true);
      }
      return;
    }
    if (activeTab === 'otc') {
      if (agreedBTCDirectOTCTerms) {
        open(getBTCDirectOTCLink());
      } else {
        navigate('/market/btcdirect-otc');
      }
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
                      showSwap={!!swapStatus?.available}
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
                        section={getActionSection(activeTab)}
                        loading={!marketCatalogResponse}
                        topLevelError={marketCatalogResponse?.success === false ? marketCatalogResponse.errorMessage : undefined}
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
