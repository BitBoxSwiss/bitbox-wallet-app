// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TConversionUnit } from '@/api/account';
import { NumberInput } from '@/components/forms';

type TProps = {
  label: TConversionUnit;
  onFiatChange: (amount: string) => void;
  disabled: boolean;
  error?: string;
  fiatAmount: string;
};

export const FiatInput = ({
  label,
  onFiatChange,
  disabled,
  error,
  fiatAmount,
}: TProps) => {
  const { t } = useTranslation();
  return (
    <NumberInput
      step="any"
      min="0"
      label={label}
      id="fiatAmount"
      onChange={onFiatChange}
      disabled={disabled}
      error={error}
      value={fiatAmount}
      placeholder={t('send.amount.placeholder')}
    />
  );
};
