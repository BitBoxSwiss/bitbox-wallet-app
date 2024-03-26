/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTranslation } from 'react-i18next';
import { ConversionUnit } from '../../../../../api/account';
import { Input } from '../../../../../components/forms';
import { ChangeEvent } from 'react';

type TProps = {
    label: ConversionUnit;
    onFiatChange: (event: ChangeEvent<HTMLInputElement>) => void;
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