// @ts-nocheck

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
import 'flag-icons';
import React, { useState, useEffect } from 'react';
import i18n from '../../i18n/i18n';
import { useTranslation } from 'react-i18next';
import { Button, Select as MySelect, ButtonLink } from '../../components/forms';
import * as exchangesAPI from '../../api/exchanges';
import { IAccount } from '../../api/account';
import { Header } from '../../components/layout';
import Guide from './guide';
import { findAccount, getCryptoName } from '../account/utils';
import { route } from '../../utils/route';
import { useLoad } from '../../hooks/api';
import { getRegionNameFromLocale } from '../../i18n/utils';
import { findLowestFee, findBestDeal, getFormattedName } from './utils';
import { ExchangeSelectionRadio } from './components/exchangeselectionradio';
import { Spinner } from '../../components/spinner/Spinner';
import { Info, FrontendExchangeDealsList } from './types';
import { Dialog } from '../../components/dialog/dialog';
import { InfoButton } from '../../components/infobutton/infobutton';
import { InfoContent } from './components/infocontent';
import { Globe } from '../../components/icon';
import { getNativeLocale } from '../../api/nativelocale';
import { setConfig } from '../../utils/config';
import { getConfig } from '../../api/backend';
import Select, { components } from 'react-select';
import style from './exchange.module.css';

type TProps = {
    code: string;
    accounts: IAccount[];

}

type TOption = {
    label: string;
    value?: string;
}

const SelectedRegionIcon = ({ regionCode }: { regionCode: string }) => {
  return <span>
    {regionCode === '' ? <Globe style={{ marginTop: '3px', width: '20px', height: '20px' }} /> : <span className={`fi fi-${regionCode}`}></span>}
  </span>;
};

export const Exchange = ({ code, accounts }: TProps) => {
  const { t } = useTranslation();

  const [showPocket, setShowPocket] = useState(false);
  const [showMoonpay, setShowMoonpay] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('');
  const [regions, setRegions] = useState<TOption[]>([]);
  const [allExchangeDeals, setAllExchanges] = useState<FrontendExchangeDealsList>();
  const [info, setInfo] = useState<Info>();

  const regionList = useLoad(exchangesAPI.getExchangesByRegion(code));
  const exchangeDeals = useLoad(exchangesAPI.getExchangeDeals);
  const nativeLocale = useLoad(getNativeLocale);
  const supportedExchanges = useLoad<exchangesAPI.SupportedExchanges>(exchangesAPI.getExchangeBuySupported(code));
  const config = useLoad(getConfig);

  const account = findAccount(accounts, code);
  const name = getCryptoName(t('buy.info.crypto'), account);

  const hasOnlyOneSupportedExchange = allExchangeDeals ? allExchangeDeals.exchanges.filter(exchange => exchange.supported).length === 1 : false;

  // update region Select component when `regionList` or `config` gets populated.
  useEffect(() => {
    if (!regionList || !config) {
      return;
    }
    const regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
    const regions = regionList.regions.map(region => ({ value: region.code, label: regionNames.of(region.code) } as TOption));

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
    const regionAvailable = !!(regionList.regions.find(region => region.code === userRegion));
    //Pre-selecting the region
    setSelectedRegion(regionAvailable ? userRegion : '');
  }, [regionList, config, nativeLocale]);

  useEffect(() => {
    if (!exchangeDeals) {
      return;
    }

    const deals = { exchanges: exchangeDeals.exchanges.map(ex => ({ ...ex, supported: ex.exchangeName === 'pocket' ? showPocket : showMoonpay })) };

    const lowestFee = findLowestFee(deals);
    const exchangesWithBestDeal = findBestDeal(deals, lowestFee);

    setAllExchanges(exchangesWithBestDeal);
  }, [selectedRegion, showMoonpay, showPocket, exchangeDeals]);

  useEffect(() => {
    if (hasOnlyOneSupportedExchange && allExchangeDeals && selectedRegion !== '') {
      const exchange = allExchangeDeals.exchanges.filter(exchange => exchange.supported);
      //there's only one exchange at this point, which is the "supported" one.
      setSelectedExchange(exchange[0].exchangeName);
    }
  }, [hasOnlyOneSupportedExchange, allExchangeDeals, selectedRegion]);

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

  const handleChangeRegion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRegion = e.target.value;
    setSelectedRegion(selectedRegion);
    setConfig({ frontend: { selectedExchangeRegion: selectedRegion } });
  };

  const handleChangeRegion2 = (e: TOption) => {
    const selectedRegion = e.value;
    setSelectedRegion(selectedRegion);
    setConfig({ frontend: { selectedExchangeRegion: selectedRegion } });
  };

  const noExchangeAvailable = !showMoonpay && !showPocket;

  /*These are fees that will be shown in the "info dialog" when user clicks on the "Info" button*/
  const infoFeesDetail = exchangeDeals?.exchanges.find(exchange => exchange.exchangeName === info)?.deals;
  const cardFee = infoFeesDetail && infoFeesDetail.find(feeDetail => feeDetail.payment === 'card')?.fee;
  const bankTransferFee = infoFeesDetail && infoFeesDetail.find(feeDetail => feeDetail.payment === 'bank-transfer')?.fee;


  const SingleValue = (props: {data: TOption}) => {
    const { label, value } = props.getValue()[0];
    return (
      <div style={{ display: 'flex', position: 'absolute', left: '8px', alignItems: 'center' }}>
        <SelectedRegionIcon regionCode={value.toLowerCase()} />
        <components.SingleValue {...props}>
          <span style={{ marginLeft: '8px' }}>{label}</span>
        </components.SingleValue>
      </div>

    );
  };

  const Option = (props: {data: TOption}) => {
    const { label, value } = props.data;
    return (
      <components.Option {...props}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SelectedRegionIcon regionCode={value.toLowerCase()}/> <span style={{ marginLeft: '8px' }}>{label}</span>
        </div>
      </components.Option>
    );
  };


  return (
    <div className="contentWithGuide">
      <div className="container">
        <Dialog medium title={info && info !== 'region' ? getFormattedName(info) : t('buy.exchange.region')} onClose={() => setInfo(undefined)} open={!!info}>
          {info && <InfoContent info={info} cardFee={cardFee} bankTransferFee={bankTransferFee} />}
        </Dialog>
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('buy.exchange.title', { name })}</h2>} />
          <div className={[style.exchangeContainer, 'content', 'narrow', 'isVerticallyCentered'].join(' ')}>
            <h1 className={style.title}>{t('buy.title', { name })}</h1>
            <p className={style.label}>{t('buy.exchange.region')}</p>
            {regions.length ? (
              <>
                <div className={style.selectContainer}>
                  {/* <div> */}
                  {/* <SelectedRegionIcon regionCode={selectedRegion.toLowerCase()}/> */}
                  {/* <MySelect
                      className={style.extraLeftSpace}
                      options={[{
                        text: t('buy.exchange.selectRegion'),
                        value: '',
                      },
                      ...regions]
                      }
                      value={selectedRegion}
                      onChange={handleChangeRegion}
                      id="exchangeRegions"
                    /> */}
                  {/* </div> */}

                  <Select
                    classNamePrefix="select"
                    components={{ SingleValue, Option, IndicatorSeparator: () => null }}
                    defaultValue={{
                      label: t('buy.exchange.selectRegion'),
                      value: '',
                    }}
                    isDisabled={false}
                    isLoading={false}
                    isRtl={false}
                    isSearchable={true}
                    onChange={handleChangeRegion2}
                    options={[{
                      label: t('buy.exchange.selectRegion'),
                      value: '',
                    },
                    ...regions]}
                  />

                  <InfoButton onClick={() => setInfo('region')} />
                </div>

                <div className={style.radioButtonsContainer}>
                  {noExchangeAvailable && (
                    <p className={style.noExchangeText}>{t('buy.exchange.noExchanges')}</p>
                  )}

                  <div>
                    {!noExchangeAvailable && allExchangeDeals && allExchangeDeals.exchanges.map(exchange => exchange.supported && (<ExchangeSelectionRadio
                      key={exchange.exchangeName}
                      id={exchange.exchangeName}
                      exchangeName={exchange.exchangeName}
                      deals={exchange.deals}
                      checked={selectedExchange === exchange.exchangeName}
                      onChange={() => setSelectedExchange(exchange.exchangeName)}
                      onClickInfoButton={setInfo}
                    />
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
