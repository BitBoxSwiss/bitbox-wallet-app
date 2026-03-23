// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Column, Grid } from '@/components/layout';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '@/components/amount/fiat-value';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './bitrefill-confirm.module.css';

type TConfirmSendProps = {
  isConfirming: boolean;
  proposedAmount: TAmountWithConversions;
  proposedFee: TAmountWithConversions;
  proposedTotal: TAmountWithConversions;
  recipientAddress: string;
};

export const ConfirmBitrefill = ({
  isConfirming,
  proposedAmount,
  proposedFee,
  proposedTotal,
  recipientAddress,
}: TConfirmSendProps) => {

  const { t } = useTranslation();

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen width="840px">
      <UseDisableBackButton />
      <ViewHeader title={<div className={style.title}>{t('send.confirm.title')}</div>} />
      <ViewContent>
        <Message type="info">
          {t('send.confirm.infoMessage')}
        </Message>

        <Grid col="2">

          <Column col="2">
            <div className={style.bitBoxContainer}>
              <PointToBitBox02 />
            </div>
          </Column>

          {/* Send amount */}
          <Column col="2">
            <span className={style.label}>
              {t('generic.send')}
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <AmountWithUnit
                amount={proposedAmount}
                enableRotateUnit
                unitClassName={style.unit}
              />
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <FiatValue
              amount={proposedAmount}
              className={style.valueOriginalLarge}
              enableRotateUnit
            />
          </Column>

          {/* To (recipient address) */}
          <Column col="2">
            <span className={style.label}>
              {t('send.confirm.to')}
            </span>
          </Column>
          <Column col="2" className={style.confirmItem}>
            <span>
              {recipientAddress}
            </span>
          </Column>

          {/* Fee */}
          <Column col="2">
            <span className={style.label}>
              {t('send.fee.label')}
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <span>
              <AmountWithUnit
                amount={proposedFee}
                alwaysShowAmounts
                enableRotateUnit
                unitClassName={style.unit}
              />
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <FiatValue
              amount={proposedFee}
              enableRotateUnit
            />
          </Column>

          {/* Total */}
          <Column col="2">
            <span className={style.label}>
              {t('send.confirm.total')}
            </span>
          </Column>
          <Column className={style.valueOriginalLarge}>
            <AmountWithUnit
              amount={proposedTotal}
              alwaysShowAmounts
              enableRotateUnit
              unitClassName={style.unit}
            />
          </Column>
          <Column className={style.valueOriginalLarge}>
            <FiatValue
              className={style.totalFiatValue}
              amount={proposedTotal}
              enableRotateUnit
            />
          </Column>

        </Grid>
      </ViewContent>
    </View>
  );
};
