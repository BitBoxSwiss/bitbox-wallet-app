// SPDX-License-Identifier: Apache-2.0

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
