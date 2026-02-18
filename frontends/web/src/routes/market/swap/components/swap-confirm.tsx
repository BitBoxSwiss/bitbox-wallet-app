// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { RatesContext } from '@/contexts/RatesContext';
import type { TAmountWithConversions } from '@/api/account';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { PointToBitBox02 } from '@/components/icon';
import { Column, Grid } from '@/components/layout';
import { FiatValue } from '@/routes/account/send/components/fiat-value';
import style from './swap-confirm.module.css';
import { useMediaQuery } from '@/hooks/mediaquery';


type TProp = {
  isConfirming: boolean;
  expectedOutput: TAmountWithConversions;
  feeAmount: TAmountWithConversions;
  sellAmount: TAmountWithConversions;
};

export const ConfrimSwap = ({
  isConfirming,
  expectedOutput,
  feeAmount,
  sellAmount,
}: TProp) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useContext(RatesContext);
  const isSmall = useMediaQuery('(max-width: 320px)');

  console.log(t, defaultCurrency);

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen textCenter width="540px">
      <UseDisableBackButton />
      <ViewHeader title={
        'Confirm swap on BitBox'
      } />
      <ViewContent>
        <Grid
          className={style.confirmData}
          responsive={isSmall}
        >
          <Column col="2" textAlign="start">
            <label>Swap</label>
          </Column>
          <Column textAlign="start">
            {sellAmount ? (
              <AmountWithUnit
                amount={sellAmount}
                enableRotateUnit
              />
            ) : 'N/A'}
          </Column>
          <Column textAlign="end">
            <FiatValue
              amount={sellAmount.amount}
              baseCurrencyUnit={defaultCurrency}
              enableRotateUnit
            />
          </Column>
          <Column col="2" textAlign="start">
            <small>Fee</small>
          </Column>
          <Column textAlign="start">
            {feeAmount ? (
              <AmountWithUnit
                amount={feeAmount}
                enableRotateUnit
              />
            ) : 'N/A'}
          </Column>
          <Column textAlign="end">
            <FiatValue
              amount={feeAmount.amount}
              baseCurrencyUnit={defaultCurrency}
              enableRotateUnit
            />
          </Column>
          <Column col="2" textAlign="start">
            <label>Receive</label>
          </Column>
          <Column textAlign="start">
            {expectedOutput ? (
              <AmountWithUnit
                amount={expectedOutput}
                enableRotateUnit
              />
            ) : 'N/A'}
          </Column>
          <Column textAlign="end">
            <FiatValue
              amount={expectedOutput.amount}
              baseCurrencyUnit={defaultCurrency}
              enableRotateUnit
            />
          </Column>
        </Grid>

        <PointToBitBox02 />

      </ViewContent>
    </View>
  );
};