// SPDX-License-Identifier: Apache-2.0

import 'flag-icons';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SingleValue } from 'react-select';
import * as marketAPI from '@/api/market';
import { getSwapStatus } from '@/api/swap';
import { AccountCode, TAccount } from '@/api/account';
import type { TLightningAccount } from '@/api/lightning';
import { View, ViewContent } from '@/components/view/view';
import { useLoad } from '@/hooks/api';
import { useLightning } from '@/hooks/lightning';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import { Header, GuidedContent, GuideWrapper, Main } from '@/components/layout';
import { MarketTab } from './components/markettab';
import { getFallbackMarketAccountCode, getRequiredKeystoreFeature, getVendorFormattedName } from './utils';
import { Spinner } from '@/components/spinner/Spinner';
import { Dialog } from '@/components/dialog/dialog';
import { alertUser } from '@/components/alert/Alert';
import { InfoButton } from '@/components/infobutton/infobutton';
import { Deals } from './components/deals';
import { useConfig } from '@/contexts/ConfigProvider';
import { CountrySelect, TOption } from './components/countryselect';
import { getBTCDirectOTCLink, getPocketOTCLink, InfoContent, TInfoContentProps } from './components/infocontent';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { open } from '@/api/system';
import { useMarketContext } from './market-context';
import { MarketGuide } from './guide';
import { isBitcoinOnly } from '../account/utils';
import { useFeatureConnect } from '@/hooks/keystore';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import type { TKeystoreFeature } from '@/api/keystores';
import style from './market.module.css';

type TProps = {
  accounts: TAccount[] | undefined;
  code: AccountCode;
};

export const Market = ({
  accounts,
  code,
}: TProps) => {
  const { lightningAccount } = useLightning();
  if (accounts === undefined || (accounts.length === 0 && lightningAccount === undefined)) {
    return null;
  }
  return <MarketContent accounts={accounts} code={code} lightningAccount={lightningAccount} />;
};

type TMarketContentProps = {
  accounts: TAccount[];
  code: AccountCode;
  lightningAccount: TLightningAccount | null | undefined;
};

const MarketContent = ({
  accounts,
  code,
  lightningAccount,
}: TMarketContentProps) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const fallbackAccount = getFallbackMarketAccountCode(accounts);
  const onlyLightning = !!lightningAccount && accounts.length === 0;

  const activeTab: marketAPI.TMarketAction = (
    onlyLightning ? 'spend' : searchParams.get('tab') as marketAPI.TMarketAction || 'buy'
  );
  const spendLightningAccount = activeTab === 'spend' ? lightningAccount : undefined;
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const { config, setConfig } = useConfig();
  const navigate = useNavigate();
  const {
    regions,
    selectedRegion,
    setSelectedRegion,
  } = useMarketContext();

  const [info, setInfo] = useState<TInfoContentProps>();
  let selectedAccount: AccountCode | undefined = (
    accounts.some(account => account.code === code) || spendLightningAccount?.code === code
      ? code
      : fallbackAccount || spendLightningAccount?.code || ''
  );
  // An unknown Spend account may be Lightning; wait for discovery before choosing a fallback.
  if (activeTab === 'spend' && code && code !== selectedAccount && lightningAccount === undefined) {
    selectedAccount = undefined;
  }
  const {
    connect,
    connectAny,
    dismissFirmwareUpgrade,
    firmwareUpgradeRequired,
  } = useFeatureConnect();

  const {
    agreedTerms: agreedBTCDirectOTCTerms,
  } = useVendorTerms(config?.frontend.skipBitsuranceDisclaimer ?? false);

  const {
    agreedTerms: agreedPocketOTCTerms,
  } = useVendorTerms(config?.frontend.skipPocketOTCDisclaimer ?? false);

  // keep URLs normalized to include the selected account.
  useEffect(() => {
    if (!selectedAccount) {
      return;
    }
    navigate(`/market/select/${selectedAccount}?tab=${activeTab}`, { replace: true });
  }, [activeTab, navigate, selectedAccount]);

  const buyDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('buy', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const sellDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('sell', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const spendDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('spend', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const swapDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('swap', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);
  const otcDealsResponse = useLoad(selectedAccount ? () => marketAPI.getMarketDeals('otc', selectedAccount, selectedRegion) : null, [selectedAccount, selectedRegion]);

  const promptConnectKeystore = async (
    accountCode: string,
    requiredFeature?: TKeystoreFeature,
  ): Promise<boolean> => {
    const account = accounts.find(acc => acc.code === accountCode);
    if (!account) {
      return false;
    }
    return connect(account.keystore.rootFingerprint, requiredFeature);
  };

  const handleAccountChange = async (accountCode: string) => {
    if (accountCode === spendLightningAccount?.code || await promptConnectKeystore(accountCode)) {
      navigate(`/market/select/${accountCode}?tab=${activeTab}`, { replace: true });
    }
  };

  const handleGoToSwap = async () => {
    const requiredFeature = getRequiredKeystoreFeature('swapkit', 'swap');
    if (!await connectAny(requiredFeature)) {
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
    if (!vendor || selectedAccount === undefined) {
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
    if (vendor === 'bitrefill' && selectedAccount === spendLightningAccount?.code) {
      navigate(`/market/bitrefill/spend/${selectedAccount}/${selectedRegion}`);
      return;
    }
    const account = accounts.find(({ code }) => code === selectedAccount);
    if (!account) {
      return;
    }
    const requiredFeature = getRequiredKeystoreFeature(vendor, activeTab, account.coinCode);
    if (!await promptConnectKeystore(selectedAccount, requiredFeature)) {
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
    <GuideWrapper>
      {firmwareUpgradeRequired && (
        <FirmwareUpgradeRequiredDialog
          open
          onClose={dismissFirmwareUpgrade}
        />
      )}
      <GuidedContent>
        <Main>
          <Header title={t('generic.buySell')} />
          <MarketTab
            accounts={accounts}
            activeTab={activeTab}
            code={selectedAccount ?? code}
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
                                lightningAccount={spendLightningAccount}
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
                      {selectedAccount === undefined ? <Spinner /> : (
                        <Deals
                          marketDealsResponse={getDealReponse(activeTab)}
                          goToVendor={goToVendor}
                          action={activeTab}
                          setInfo={setInfo}
                        />
                      )}
                    </div>
                  </>
                ) : <Spinner />}
              </div>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <MarketGuide translationContext={translationContext} />
    </GuideWrapper>
  );
};
