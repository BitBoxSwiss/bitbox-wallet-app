// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as marketAPI from '@/api/market';
import type { TInfoContentProps, TPaymentFee } from './infocontent';
import { Skeleton } from '@/components/skeleton/skeleton';
import { InfoButton } from '@/components/infobutton/infobutton';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { VendorDeals } from '@/routes/market/components/vendor-deals';
import style from './deals.module.css';

type TProps = {
  marketDealsResponse: marketAPI.TMarketDealsResponse | undefined;
  goToVendor: (vendor: string) => void;
  action: marketAPI.TMarketAction;
  setInfo: (info: TInfoContentProps) => void;
};

export const Deals = ({
  marketDealsResponse,
  goToVendor,
  action,
  setInfo,
}: TProps) => {
  const { t } = useTranslation();


  const buildInfo = (marketDeals: marketAPI.TMarketDeals): TInfoContentProps => {
    let paymentFees: TPaymentFee = {};
    marketDeals.deals.forEach(deal => deal.payment && (paymentFees[deal.payment] = deal.fee));
    return {
      action,
      vendorName: marketDeals.vendorName,
      paymentFees,
    };
  };

  return (
    <>
      <div className={style.innerRadioButtonsContainer}>
        {!marketDealsResponse && <Skeleton />}
        {marketDealsResponse?.success === false ? (
          <div className="flex flex-column">
            <p className={style.noExchangeText}>
              {marketDealsResponse?.success === false && (
                marketDealsResponse.errorCode
                  ? t('exchange.buySell.' + marketDealsResponse.errorCode)
                  : marketDealsResponse.errorMessage
              )}
            </p>
          </div>
        ) : (
          <div className={style.exchangeProvidersContainer}>
            {marketDealsResponse?.success && action === 'otc' && (
              t('buy.exchange.otcInfo')
            )}
            {marketDealsResponse?.deals
              // skip the vendors that have only hidden deals.
              .filter(vendor => (vendor.deals.some(deal => !deal.isHidden)))
              .map(vendor => (
                <div key={vendor.vendorName} className={style.actionableItemContainer}>
                  <ActionableItem
                    key={vendor.vendorName}
                    onClick={() => {
                      goToVendor(vendor.vendorName);
                    }}>
                    <VendorDeals
                      deals={vendor.deals}
                      vendorName={vendor.vendorName}
                    />
                  </ActionableItem>

                  <InfoButton onClick={() => setInfo(buildInfo(vendor))} />
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
};
