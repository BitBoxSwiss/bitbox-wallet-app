// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as marketAPI from '@/api/market';
import type { TInfoContentProps, TPaymentFee } from './infocontent';
import { Skeleton } from '@/components/skeleton/skeleton';
import { InfoButton } from '@/components/infobutton/infobutton';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { VendorDeals } from '@/routes/market/components/vendor-deals';
import { getVendorFormattedName } from '../utils';
import style from './deals.module.css';

type TProps = {
  section: marketAPI.TActionSection | undefined;
  loading: boolean;
  topLevelError?: string;
  goToVendor: (vendor: string) => void;
  action: marketAPI.TMarketAction;
  setInfo: (info: TInfoContentProps) => void;
};

export const Deals = ({
  section,
  loading,
  topLevelError,
  goToVendor,
  action,
  setInfo,
}: TProps) => {
  const { t } = useTranslation();

  const buildOfferInfo = (offerVendor: marketAPI.TOfferVendor): TInfoContentProps => {
    let paymentFees: TPaymentFee = {};
    offerVendor.offers.forEach(offer => offer.payment && (paymentFees[offer.payment] = offer.fee));
    return {
      action,
      vendorName: offerVendor.vendorName,
      paymentFees,
    };
  };

  const buildServiceInfo = (service: marketAPI.TService): TInfoContentProps => ({
    action,
    vendorName: service.vendorName,
    paymentFees: {},
  });

  return (
    <div className={style.innerRadioButtonsContainer}>
      {loading && <Skeleton />}
      {!loading && topLevelError && (
        <div className="flex flex-column">
          <p className={style.noExchangeText}>{topLevelError}</p>
        </div>
      )}
      {!loading && !topLevelError && section && !section.success && (
        <div className="flex flex-column">
          <p className={style.noExchangeText}>
            {section.errorCode
              ? t('exchange.buySell.' + section.errorCode)
              : t('genericError')}
          </p>
        </div>
      )}
      {!loading && !topLevelError && section?.success && (
        <div className={style.exchangeProvidersContainer}>
          {action === 'otc' && t('buy.exchange.otcInfo')}
          {(section.offerVendors || [])
            // skip vendors that have only hidden offers.
            .filter(vendor => vendor.offers.some(offer => !offer.isHidden))
            .map(vendor => (
              <div key={vendor.vendorName} className={style.actionableItemContainer}>
                <ActionableItem
                  key={vendor.vendorName}
                  onClick={() => {
                    goToVendor(vendor.vendorName);
                  }}>
                  <VendorDeals
                    offers={vendor.offers}
                    vendorName={vendor.vendorName}
                  />
                </ActionableItem>

                <InfoButton onClick={() => setInfo(buildOfferInfo(vendor))} />
              </div>
            ))}

          {(section.services || []).map(service => (
            <div key={service.vendorName} className={style.actionableItemContainer}>
              <ActionableItem
                onClick={() => {
                  goToVendor(service.vendorName);
                }}>
                <div className={style.exchangeProvidersContainer}>
                  <h3>{getVendorFormattedName(service.vendorName)}</h3>
                  <p className={style.noExchangeText}>
                    {t('buy.exchange.description', { context: service.vendorName })}
                  </p>
                </div>
              </ActionableItem>

              {service.vendorName !== 'swapkit' && (
                <InfoButton onClick={() => setInfo(buildServiceInfo(service))} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
