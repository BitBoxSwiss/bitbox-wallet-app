// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLightningBalance } from '@/api/lightning';
import { Balance } from '@/components/balance/balance';
import { NumberInput } from '@/components/forms';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad } from '@/hooks/api';
import { useSatFiatAmount } from '../../hooks/use-sat-fiat-amount';
import styles from '../send.module.css';

type TProps = {
  maxAmountSat?: number;
  minAmountSat?: number;
  onAmountChange: (amountSat?: number) => void;
};

export const PaymentBalance = () => {
  const { lightningUnit, rotateLightningUnit } = useContext(RatesContext);
  const balance = useLoad(getLightningBalance, [lightningUnit]);

  return (
    <div className={styles.availableBalance}>
      <Balance balance={balance} onRotateUnit={rotateLightningUnit} />
    </div>
  );
};

export const CustomPaymentAmount = ({
  maxAmountSat,
  minAmountSat = 0,
  onAmountChange,
}: TProps) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useContext(RatesContext);
  const {
    amountSat,
    handleFiatAmountChange,
    handleSatsAmountChange,
    inputFiatText,
    inputSatsText,
  } = useSatFiatAmount({ defaultCurrency });

  useEffect(() => {
    onAmountChange(amountSat);
  }, [amountSat, onAmountChange]);

  return (
    <>
      <PaymentBalance />
      <NumberInput
        step="1"
        min={minAmountSat}
        max={maxAmountSat}
        label={t('lightning.receive.amountSats.label')}
        placeholder={t('lightning.receive.amountSats.placeholder')}
        id="amountSatsInput"
        onChange={(satsText) => {
          onAmountChange(undefined);
          void handleSatsAmountChange(satsText);
        }}
        value={inputSatsText}
        autoFocus
      />
      <NumberInput
        step="any"
        min="0"
        label={defaultCurrency}
        placeholder={t('send.amount.placeholder')}
        id="amountFiatInput"
        onChange={(fiatText) => {
          onAmountChange(undefined);
          void handleFiatAmountChange(fiatText);
        }}
        value={inputFiatText}
      />
    </>
  );
};
