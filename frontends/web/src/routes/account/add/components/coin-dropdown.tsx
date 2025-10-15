
/**
 * Copyright 2021-2024 Shift Crypto AG
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
import * as backendAPI from '@/api/backend';
import { Logo } from '@/components/icon/logo';
import { Dropdown } from '@/components/dropdown/dropdown';
import styles from './coin-dropdown.module.css';

type TCoinDropDownProps = {
  onChange: (coin: backendAPI.TCoin) => void;
  supportedCoins: backendAPI.TCoin[];
  value: string;
};

type TOption = {
  label: string;
  value: backendAPI.TCoin['coinCode'];
};

const Option = ({ props }: { props: TOption }) => {
  const { label, value } = props;
  return (
    <div className={styles.valueContainer}>
      <Logo coinCode={value} alt={label} />
      <span className={styles.coinName}>{label}</span>
    </div>
  );
};

export const CoinDropDown = ({
  onChange,
  supportedCoins,
  value,
}: TCoinDropDownProps) => {
  const { t } = useTranslation();

  const options = supportedCoins.map(({ coinCode, name, canAddAccount }) => ({
    value: coinCode,
    label: name,
    isDisabled: !canAddAccount,
  }));

  return (
    <Dropdown
      isSearchable={false}
      placeholder={t('buy.info.selectPlaceholder')}
      classNamePrefix="react-select"
      value={options.find(option => option.value === value) || []}
      renderOptions={o => <Option props={o} />}
      onChange={(selected) => {
        const selectedCoin = supportedCoins.find(c => c.coinCode === selected.value);
        if (selectedCoin) {
          onChange(selectedCoin);
        }
      }}
      options={options}
    />
  );
};
