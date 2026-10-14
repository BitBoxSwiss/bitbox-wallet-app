// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getBtcSatAmount } from '@/api/coins';
import { getLightningBalance, subscribeLightningBalance } from '@/api/lightning';
import { Balance } from '@/components/balance/balance';
import { Checkbox, NumberInput } from '@/components/forms';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad, useSync } from '@/hooks/api';
import { useSatFiatAmount } from '../../hooks/use-sat-fiat-amount';
import styles from '../send.module.css';

type TProps = {
  children?: ReactNode;
  maxAmountSat?: number;
  minAmountSat?: number;
  onAmountChange: (amountSat?: number) => void;
  sendAll: boolean;
  sendAllAmountSat?: number;
  onSendAllChange: (sendAll: boolean) => void;
};

export const PaymentBalance = () => {
  const balance = useSync(getLightningBalance, subscribeLightningBalance);

  return (
    <div className={styles.availableBalance}>
      <Balance balance={balance} />
    </div>
  );
};

export const CustomPaymentAmount = ({
  children,
  maxAmountSat,
  minAmountSat = 0,
  onAmountChange,
  sendAll,
  sendAllAmountSat,
  onSendAllChange,
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

  const sendAllAmount = useLoad(
    sendAll && sendAllAmountSat !== undefined
      ? () => getBtcSatAmount({ source: 'sat', amount: sendAllAmountSat.toString() }).catch(() => undefined)
      : null,
    [sendAll, sendAllAmountSat],
  );

  useEffect(() => {
    if (!sendAll) {
      onAmountChange(amountSat);
    }
  }, [amountSat, onAmountChange, sendAll]);

  return (
    <>
      <PaymentBalance />
      {children}
      <NumberInput
        step="1"
        min={minAmountSat}
        max={maxAmountSat}
        label={t('lightning.receive.amountSats.label')}
        placeholder={t('lightning.receive.amountSats.placeholder')}
        id="amountSatsInput"
        onChange={(satsText) => {
          onAmountChange(undefined);
          handleSatsAmountChange(satsText);
        }}
        disabled={sendAll}
        value={sendAll ? sendAllAmountSat?.toString() ?? '' : inputSatsText}
        labelSection={
          <Checkbox
            label={t('send.maximum')}
            id="sendAll"
            checked={sendAll}
            onChange={event => onSendAllChange(event.target.checked)}
          />
        }
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
          handleFiatAmountChange(fiatText);
        }}
        disabled={sendAll}
        value={sendAll
          ? (sendAllAmount?.success ? sendAllAmount.amount.unformattedConversions?.[defaultCurrency] ?? '' : '')
          : inputFiatText}
      />
    </>
  );
};
