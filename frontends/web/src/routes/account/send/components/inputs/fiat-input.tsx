// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { ConversionUnit } from '@/api/account';
import { NumberInput } from '@/components/forms';

type TProps = {
  label: ConversionUnit;
  onFiatChange: (amount: string) => void;
  disabled: boolean;
  error?: string;
  fiatAmount: string;
  hideValue?: boolean;
};

export const FiatInput = ({
  label,
  onFiatChange,
  disabled,
  error,
  fiatAmount,
  hideValue = false,
}: TProps): JSX.Element => {
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
      value={hideValue ? '' : fiatAmount}
      placeholder={hideValue ? '***' : t('send.amount.placeholder')}
    />
  );
};
