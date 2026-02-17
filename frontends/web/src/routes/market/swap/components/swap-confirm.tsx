// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { PointToBitBox02 } from '@/components/icon';
import { Column, Grid } from '@/components/layout';
import { FiatValue } from '@/routes/account/send/components/fiat-value';
import style from './swap-confirm.module.css';

type TProp = {
  isConfirming: boolean;
  expectedOutput: TAmountWithConversions;
  feeAmount: TAmountWithConversions;
  sellAmount: TAmountWithConversions;
};

export const ConfirmSwap = ({
  isConfirming,
  expectedOutput,
  feeAmount,
  sellAmount,
}: TProp) => {
  const { t } = useTranslation();
  const isSmall = useMediaQuery('(max-width: 320px)');

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen width="540px" verticallyCentered>
      <UseDisableBackButton />
      <ViewHeader title={
        'Confirm swap on BitBox'
      } />
      <ViewContent>
        <Grid responsive={isSmall}>
          <Column col="2" textAlign="start" className={style.label}>
            {t('generic.swap')}
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            {sellAmount ? (
              <span className={style.valueOriginalLarge}>
                <AmountWithUnit
                  amount={sellAmount}
                  enableRotateUnit
                />
              </span>
            ) : 'N/A'}
          </Column>
          <Column textAlign="end" className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <FiatValue
                amount={sellAmount}
                enableRotateUnit
              />
            </span>
          </Column>
          <Column col="2" textAlign="start" className={style.label}>
            <small>Fee</small>
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            {feeAmount ? (
              <AmountWithUnit
                amount={feeAmount}
                enableRotateUnit
              />
            ) : 'N/A'}
          </Column>
          <Column textAlign="end" className={style.confirmItem}>
            <FiatValue
              amount={feeAmount}
              enableRotateUnit
            />
          </Column>
          <Column col="2" textAlign="start" className={style.label}>
            Receive
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            {expectedOutput ? (
              <span className={style.valueOriginalLarge}>
                <AmountWithUnit
                  amount={expectedOutput}
                  enableRotateUnit
                />
              </span>
            ) : 'N/A'}
          </Column>
          <Column textAlign="end" className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <FiatValue
                amount={expectedOutput}
                enableRotateUnit
              />
            </span>
          </Column>
        </Grid>

        <PointToBitBox02 />

      </ViewContent>
    </View>
  );
};
