// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { PointToBitBox02 } from '@/components/icon';
import { Column, Grid } from '@/components/layout';
import { FiatValue } from '@/components/amount/fiat-value';
import style from './swap-confirm.module.css';
import { SelectedUTXOs } from '@/routes/account/send/components/confirm/selected-utxos';
import type { TSelectedUTXOs } from '@/routes/account/send/utxos';

type TProps = {
  isConfirming: boolean;
  expectedOutput: TAmountWithConversions;
  feeAmount: TAmountWithConversions;
  selectedUTXOs?: TSelectedUTXOs;
  sellAmount: TAmountWithConversions;
  utxoSelectionMode?: 'automatic' | 'manual';
};

export const ConfirmSwap = ({
  isConfirming,
  expectedOutput,
  feeAmount,
  selectedUTXOs,
  sellAmount,
  utxoSelectionMode,
}: TProps) => {
  const { t } = useTranslation();
  const isSmall = useMediaQuery('(max-width: 320px)');

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen width="540px" verticallyCentered>
      <UseDisableBackButton />
      <ViewHeader title={
        t('swap.confirmOnBitBox')
      } />
      <ViewContent>
        <Grid responsive={isSmall}>
          <Column col="2" textAlign="start" className={style.label}>
            {t('generic.swap')}
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <AmountWithUnit
                amount={sellAmount}
                enableRotateUnit
              />
            </span>
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
            <small>{t('send.fee.label')}</small>
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            <AmountWithUnit
              amount={feeAmount}
              enableRotateUnit
            />
          </Column>
          <Column textAlign="end" className={style.confirmItem}>
            <FiatValue
              amount={feeAmount}
              enableRotateUnit
            />
          </Column>
          {utxoSelectionMode && selectedUTXOs && Object.keys(selectedUTXOs).length > 0 && (
            <Column col="2" textAlign="start" className={style.confirmItem}>
              <SelectedUTXOs
                selectedUTXOs={selectedUTXOs}
                title={t(`swap.utxoSelection.${utxoSelectionMode}.selectedTitle`)}
              />
            </Column>
          )}
          <Column col="2" textAlign="start" className={style.label}>
            {t('generic.receiveWithoutCoinCode')}
          </Column>
          <Column textAlign="start" className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <AmountWithUnit
                amount={expectedOutput}
                enableRotateUnit
              />
            </span>
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
