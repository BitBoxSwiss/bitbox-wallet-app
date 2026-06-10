// SPDX-License-Identifier: Apache-2.0

import 'flag-icons';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SingleValue } from 'react-select';
import * as marketAPI from '@/api/market';
import { getSwapStatus } from '@/api/swap';
import { AccountCode, TAccount } from '@/api/account';
import { View, ViewContent } from '@/components/view/view';
import { useLoad } from '@/hooks/api';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { MarketTab } from './components/markettab';
import { getFallbackMarketAccountCode, getVendorFormattedName } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { alertUser } from '@/components/alert/Alert';
import { InfoButton } from '@/components/infobutton/infobutton';
import { Deals } from './components/deals';
import { useConfig } from '@/contexts/ConfigProvider';
import { CountrySelect, TOption } from './components/countryselect';
import { getBTCDirectOTCLink, getPocketOTCLink, InfoContent, TInfoContentProps } from './components/infocontent';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { connectAnyKeystore, connectKeystore } from '@/api/keystores';
import { open } from '@/api/system';
import { useMarketContext } from './market-context';
import { MarketGuide } from './guide';
import { isBitcoinOnly } from '../account/utils';
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
  const [searchParams] = useSearchParams();

  const activeTab: marketAPI.TMarketAction = searchParams.get('tab') as marketAPI.TMarketAction || 'buy';
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const { config, setConfig } = useConfig();
  const navigate = useNavigate();
  const {
    regions,
    selectedRegion,
    setSelectedRegion,
  } = useMarketContext();
  const validRouteAccountCode = accounts.some(account => account.code === code) ? code : '';

  const [info, setInfo] = useState<TInfoContentProps>();
  const selectedAccount = validRouteAccountCode || getFallbackMarketAccountCode(accounts);

  const {
    agreedTerms: agreedBTCDirectOTCTerms,
  } = useVendorTerms(config?.frontend.skipBitsuranceDisclaimer ?? false);

  const {
    agreedTerms: agreedPocketOTCTerms,
  } = useVendorTerms(config?.frontend.skipPocketOTCDisclaimer ?? false);

  // keep URLs normalized to include the selected account.
  useEffect(() => {
    if (validRouteAccountCode || !selectedAccount) {
      return;
    }
    navigate(`/market/select/${selectedAccount}?tab=${activeTab}`, { replace: true });
  }, [activeTab, navigate, selectedAccount, validRouteAccountCode]);

  const buyDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('buy', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const sellDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('sell', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const spendDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('spend', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const swapDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('swap', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const otcDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('otc', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);

  const promptConnectKeystore = async (accountCode: string): Promise<boolean> => {
    const account = accounts.find(acc => acc.code === accountCode);
    if (!account) {
      return false;
    }
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    return connectResult.success;
  };

  const handleAccountChange = async (accountCode: string) => {
    if (await promptConnectKeystore(accountCode)) {
      navigate(`/market/select/${accountCode}?tab=${activeTab}`, { replace: true });
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
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('generic.buySell')}</h2>} />
          <MarketTab
            accounts={accounts}
            activeTab={activeTab}
            code={code}
          />
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
                                accounts={accounts}
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
        </GuidedContent>
        <MarketGuide translationContext={translationContext} />
      </GuideWrapper>
    </Main>
  );
};
