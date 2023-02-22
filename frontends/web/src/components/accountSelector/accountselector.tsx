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
import { AccountCode } from '../../api/account';
import { Button, Select } from '../forms';

type TOption = {
    text: string;
    value: AccountCode;
}

type TAccountSelector = {
    title: string;
    options: TOption[];
    selected?: string;
    onChange: (value: string) => void;
    onProceed: () => void;
}

export const AccountSelector = ({ title, options, selected, onChange, onProceed }: TAccountSelector) => {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="title text-center">{title}</h1>
      <Select
        options={[{
          text: t('buy.info.selectLabel'),
          disabled: true,
          value: 'choose',
        },
        ...options]
        }
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        value={selected || 'choose'}
        id="coinAndAccountCode"
      />
      <div className="buttons text-center">
        <Button
          primary
          onClick={onProceed}
          disabled={!selected}>
          {t('buy.info.next')}
        </Button>
      </div>
    </>
  );
};
