import { useNavigate } from 'react-router-dom';
import { useLoad } from '../../../hooks/api';
import * as exchangesAPI from '../../../api/exchanges';
import { findBestDeal, findLowestFee, getSellExchangeSupportedAccounts } from '../utils';
import { useEffect, useState } from 'react';
import { FrontendExchangeDealsList } from '../types';
import { ExchangeSelectionRadio } from './exchangeselectionradio';
import { Button } from '../../../components/forms/button';
import { useTranslation } from 'react-i18next';
import { IAccount } from '../../../api/account';
import { getVersion } from '../../../api/bitbox02';
import style from '../exchange.module.css';

type TProps = {
  accounts: IAccount[];
  accountCode: string;
  deviceIDs: string[];
  selectedRegion: string;
  onSelectExchange: (exchange: string) => void;
  selectedExchange: string;
}

type TExchangeNotAvailableReason = 'coinCode' | 'region' | 'version';

export const Sell = ({
  accounts,
  accountCode,
  deviceIDs,
  selectedRegion,
  onSelectExchange,
  selectedExchange
}: TProps) => {
  const { t } = useTranslation();

  const exchangeDeals = useLoad(() => exchangesAPI.getExchangeDeals());
  const versionInfo = useLoad(() => getVersion(deviceIDs[0]), [deviceIDs[0]]);
  const [showPocket, setShowPocket] = useState(false);
  const [showMoonpay, setShowMoonpay] = useState(false);
  const [allExchangeDeals, setAllExchanges] = useState<FrontendExchangeDealsList>();
  const [supportedAccounts, setSupportedAccounts] = useState<IAccount[]>([]);
  const [exchangeNotAvailableReason, setExchangeNotAvailableReason] = useState<TExchangeNotAvailableReason | undefined>();
  const navigate = useNavigate();

  const supportedSellProviders = useLoad<exchangesAPI.SupportedExchanges>(() => exchangesAPI.getExchangeSellSupported());
  const sellRegionList = useLoad(() => exchangesAPI.getSellExchangesByRegion());
  const hasOnlyOneSupportedExchange = allExchangeDeals ? allExchangeDeals.exchanges.filter(exchange => exchange.supported).length === 1 : false;
  const showUpgradeFirmwareButton = !versionInfo || (versionInfo && versionInfo.canUpgrade);

  // get the list of accounts supported by exchanges, needed to correctly handle back button.
  useEffect(() => {
    getSellExchangeSupportedAccounts(accounts).then(setSupportedAccounts);
  }, [accounts]);

  // get all exchanges to be rendered as the radio btns
  useEffect(() => {
    if (!exchangeDeals) {
      return;
    }

    const deals = { exchanges: exchangeDeals.exchanges.map(ex => ({ ...ex, supported: ex.exchangeName === 'pocket' ? showPocket : showMoonpay })) };

    const lowestFee = findLowestFee(deals);
    const exchangesWithBestDeal = findBestDeal(deals, lowestFee);

    setAllExchanges(exchangesWithBestDeal);
  }, [selectedRegion, showMoonpay, showPocket, exchangeDeals]);

  // update exchange list when:
  // - pocket/moonpay supported async calls return
  // - new region has been selected
  // - regionList gets populated
  useEffect(() => {
    if (!hasOnlyOneSupportedExchange) {
      onSelectExchange('');
    }

    if (!supportedSellProviders) {
      setShowPocket(false);
      setShowMoonpay(false);
      return;
    }

    if (selectedRegion === '') {
      setShowPocket(supportedSellProviders.exchanges.includes('pocket'));
      setShowMoonpay(supportedSellProviders
        .exchanges.includes('moonpay'));
      return;
    }

    if (!sellRegionList) {
      return;
    }

    setShowPocket(false);
    setShowMoonpay(false);
    sellRegionList.regions.forEach(region => {
      if (region.code === selectedRegion) {
        setShowPocket(region.isPocketEnabled);
        setShowMoonpay(region.isMoonpayEnabled);
        return;
      }
    });


  }, [selectedRegion, sellRegionList, supportedSellProviders, hasOnlyOneSupportedExchange, onSelectExchange]);

  // default select exchange if only has one supported exchange
  useEffect(() => {
    if (hasOnlyOneSupportedExchange && allExchangeDeals && selectedRegion !== '') {
      const exchange = allExchangeDeals.exchanges.filter(exchange => exchange.supported);
      //there's only one exchange at this point, which is the "supported" one.
      onSelectExchange(exchange[0].exchangeName);
    }
  }, [hasOnlyOneSupportedExchange, allExchangeDeals, selectedRegion, onSelectExchange]);

  useEffect(() => {
    if (showUpgradeFirmwareButton) {
      setExchangeNotAvailableReason('version');
      return;
    }

    const noExchangeAvailable = !showMoonpay && !showPocket;
    const hasNoSupportedAccount = !supportedAccounts.some(a => a.code === accountCode);


    if (hasNoSupportedAccount) {
      setExchangeNotAvailableReason('coinCode');
      return;
    }

    if (noExchangeAvailable) {
      setExchangeNotAvailableReason('region');
      return;
    }

    setExchangeNotAvailableReason(undefined);

  }, [showMoonpay, showPocket, supportedAccounts, accountCode, versionInfo, showUpgradeFirmwareButton]);

  const constructErrorMessage = () => {
    switch (exchangeNotAvailableReason) {
    case 'coinCode':
      return t('No sell options available for this coin type.');
    case 'region':
      return t('No sell options available for this region.');
    case 'version':
      return t('Update firmware to sell.');
    default:
      return 'not-supported';
    }
  };

  const hasExchange = !exchangeNotAvailableReason && allExchangeDeals;

  return (
    <>
      <div className={style.innerRadioButtonsContainer}>
        {exchangeNotAvailableReason && (
          <div className="flex flex-column">
            <p className={style.noExchangeText}>{constructErrorMessage()}</p>
            {showUpgradeFirmwareButton &&
              <Button
                className={style.updateButton}
                onClick={() => {
                  navigate(`/settings/device-settings/${deviceIDs[0]}`);
                }}
                transparent>
                {t('Update now')}
              </Button>
            }
          </div>
        )}
        {hasExchange && allExchangeDeals.exchanges.map(exchange => exchange.supported && (
          <ExchangeSelectionRadio
            key={exchange.exchangeName}
            id={exchange.exchangeName}
            exchangeName={exchange.exchangeName}
            deals={exchange.deals}
            checked={selectedExchange === exchange.exchangeName}
            onChange={() => {
              onSelectExchange(exchange.exchangeName);
            }}
            onClickInfoButton={() => {}}
          />
        ))}
      </div>
      {!exchangeNotAvailableReason &&
          <div className={style.buttonsContainer}>
            {supportedAccounts.length > 1 && (
              <Button
                className={style.buttonBack}
                secondary
                onClick={() => navigate('/buy/info')}>
                {t('button.back')}
              </Button>
            )
            }
            <Button
              primary
              disabled={!selectedExchange}
              onClick={() => alert('WIP')} >
              {t('button.next')}
            </Button>
          </div>
      }
    </>
  );
};
