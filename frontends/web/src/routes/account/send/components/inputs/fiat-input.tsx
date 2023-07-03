import { useTranslation } from 'react-i18next';
import { ConversionUnit } from '../../../../../api/account';
import { Input } from '../../../../../components/forms';

type TProps = {
    label: ConversionUnit;
    onFiatChange: (event: Event) => void;
    disabled: boolean;
    error?: string;
    fiatAmount: string;
}

export const FiatInput = ({ label, onFiatChange, disabled, error, fiatAmount }: TProps) => {
  const { t } = useTranslation();
  return (
    <Input
      type="number"
      step="any"
      min="0"
      label={label}
      id="fiatAmount"
      onInput={onFiatChange}
      disabled={disabled}
      error={error}
      value={fiatAmount}
      placeholder={t('send.amount.placeholder')}
    />
  );
};