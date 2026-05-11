// SPDX-License-Identifier: Apache-2.0

import 'flag-icons';
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SingleValue } from 'react-select';
import { i18n } from '@/i18n/i18n';
import * as marketAPI from '@/api/market';
import { getSwapStatus } from '@/api/swap';
import { AccountCode, TAccount } from '@/api/account';
import { View, ViewContent } from '@/components/view/view';
import { useLoad } from '@/hooks/api';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import { getRegionNameFromLocale } from '@/i18n/utils';
import { getVendorFormattedName } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { alertUser } from '@/components/alert/Alert';
import { InfoButton } from '@/components/infobutton/infobutton';
import { getMarketActionFromSearchParams, getMarketSelectPath } from './components/marketplace-navigation';
import { Deals } from './components/deals';
import { getNativeLocale } from '@/api/nativelocale';
import { getConfig, setConfig } from '@/utils/config';
import { CountrySelect, TOption } from './components/countryselect';
import { getBTCDirectOTCLink, getPocketOTCLink, InfoContent, TInfoContentProps } from './components/infocontent';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { open } from '@/api/system';
import type { TMarketplaceOutletContext } from './marketplace-layout';
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
  const marketplaceContext = useOutletContext<TMarketplaceOutletContext | undefined>();
  const [searchParams] = useSearchParams();
  const marketAccountCode = marketplaceContext?.marketAccountCode;
  const setMarketAccountCode = marketplaceContext?.setMarketAccountCode;
  const validRouteAccountCode = accounts.some(account => account.code === code) ? code : '';
  const validMarketAccountCode = accounts.some(account => account.code === marketAccountCode) ? marketAccountCode : '';

  const [selectedAccount, setSelectedAccount] = useState<string>(validRouteAccountCode || validMarketAccountCode || '');
  const [localSelectedRegion, setLocalSelectedRegion] = useState('');
  const [localRegions, setLocalRegions] = useState<TOption[]>([]);
  const [info, setInfo] = useState<TInfoContentProps>();
  const [supportedAccounts, setSupportedAccounts] = useState<TAccount[]>(accounts);
  const activeTab = getMarketActionFromSearchParams(searchParams);
  const regions = marketplaceContext?.regions ?? localRegions;
  const selectedRegion = marketplaceContext?.selectedRegion ?? localSelectedRegion;
  const setRegions = marketplaceContext?.setRegions ?? setLocalRegions;
  const setSelectedRegion = marketplaceContext?.setSelectedRegion ?? setLocalSelectedRegion;

  const regionCodes = useLoad(marketAPI.getMarketRegionCodes);
  const nativeLocale = useLoad(getNativeLocale);
  const config = useLoad(getConfig);

  const {
    agreedTerms: agreedBTCDirectOTCTerms,
  } = useVendorTerms(!!config?.frontend?.skipBitsuranceDisclaimer);

  const {
    agreedTerms: agreedPocketOTCTerms,
  } = useVendorTerms(!!config?.frontend?.skipPocketOTCDisclaimer);

  // keep account list in sync and ensure a valid selected account.
  useEffect(() => {
    setSupportedAccounts(accounts);
    const selectedAccountIsValid = accounts.some(account => account.code === selectedAccount);
    const accountOfConnectedKeystore = accounts.find(account => account.keystore.connected);
    const nextAccount = validRouteAccountCode
      || (selectedAccountIsValid ? selectedAccount : '')
      || accountOfConnectedKeystore?.code
      || accounts[0]?.code
      || '';
    if (nextAccount) {
      setMarketAccountCode?.(nextAccount);
      if (!validRouteAccountCode) {
        navigate(getMarketSelectPath(activeTab, nextAccount), { replace: true });
      }
    }
    if (nextAccount !== selectedAccount) {
      setSelectedAccount(nextAccount);
    }
  }, [accounts, activeTab, navigate, selectedAccount, setMarketAccountCode, validRouteAccountCode]);

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
      setSelectedRegion('');
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
    const nextRegion = regionAvailable ? userRegion : '';
    setSelectedRegion(nextRegion);
  }, [regionCodes, config, nativeLocale, setRegions, setSelectedRegion]);

  const buyDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('buy', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const sellDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('sell', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const spendDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('spend', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const swapDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('swap', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const otcDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('otc', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);

  const promptConnectKeystore = async (accountCode: string): Promise<boolean> => {
    const account = supportedAccounts.find(acc => acc.code === accountCode);
    if (!account) {
      return false;
    }
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    return connectResult.success;
  };

  const handleAccountChange = async (accountCode: string) => {
    if (await promptConnectKeystore(accountCode)) {
      setMarketAccountCode?.(accountCode);
      setSelectedAccount(accountCode);
      navigate(getMarketSelectPath(activeTab, accountCode), { replace: true });
    }
  };

  const handleGoToSwap = async () => {
    const connectResult = await connectAnyKeystore();
    if (!connectResult.success) {
      return;
    }

    const currentSwapStatus = await getSwapStatus();
    if (currentSwapStatus.connectedKeystore === 'multi') {
      navigate('/market/swap');
      return;
    }
    if (currentSwapStatus.connectedKeystore === 'btc-only') {
      alertUser(t('connectKeystore.swapHint'));
    }
  };


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
    case 'otc':
      return 'OTC';
    }
  };

  const goToVendor = async (vendor: marketAPI.TVendorName) => {
    if (!vendor) {
      return;
    }
    switch (activeTab) {
    case 'swap':
      await handleGoToSwap();
      return;
    case 'otc':
      switch (vendor) {
      case 'btcdirect-otc':
        if (agreedBTCDirectOTCTerms) {
          open(getBTCDirectOTCLink());
        } else {
          navigate('/market/btcdirect-otc');
        }
        return;
      case 'pocket-otc':
        if (agreedPocketOTCTerms) {
          open(getPocketOTCLink());
        } else {
          navigate('/market/pocket-otc');
        }
        return;
      }
    }
    if (!selectedAccount || !await promptConnectKeystore(selectedAccount)) {
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

  return (
    <>
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
      <View
        fullscreen={false}
        minHeight="600px"
        width="550px"
      >
        <ViewContent fullWidth>
          <div className={style.exchangeContainer}>
            {regions.length ? (
              <>
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

                <div className={style.offeringContainer}>
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
    </>
  );
};
