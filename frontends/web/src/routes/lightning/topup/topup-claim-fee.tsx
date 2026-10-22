// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TAmountWithConversions } from '@/api/account';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import styles from './topup.module.css';

type TProps = {
  amount: TAmountWithConversions | null;
};

export const TopUpClaimFee = ({ amount }: TProps) => {
  const { t } = useTranslation();

  return (
    <p className={styles.claimFee}>
      <span>{t('lightning.topUp.estimatedClaimFee')}</span>:
      {' '}
      {amount ? (
        <>
          <AmountWithUnit amount={amount} alwaysShowAmounts wrap />
          {' ('}
          <AmountWithUnit amount={amount} convertToFiat alwaysShowAmounts wrap />
          {')'}
        </>
      ) : t('generic.unavailable')}
      <br />
      <span>{t('lightning.topUp.claimFeeInfo')}</span>
    </p>
  );
};
