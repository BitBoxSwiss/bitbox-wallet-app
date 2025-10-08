/**
 * Copyright 2023-2024 Shift Crypto AG
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
import { SingleValue } from 'react-select';
import { useDarkmode } from '@/hooks/darkmode';
import { Dropdown } from '@/components/dropdown/dropdown';
import { GlobeDark, GlobeLight } from '@/components/icon';
import styles from './countryselect.module.css';

export type TOption = {
  label: string;
  value: string;
}

type TProps = {
  onChangeRegion: (newValue: SingleValue<TOption>) => void;
  regions: TOption[];
  selectedRegion: string;
}

const SelectedRegionIcon = ({ regionCode }: { regionCode: string }) => {
  const { isDarkMode } = useDarkmode();
  const globe = isDarkMode ? <GlobeLight className={styles.globe} /> : <GlobeDark className={styles.globe} />;
  return (
    <span>
      {regionCode === '' ? globe : (
        <span className={`fi fi-${regionCode} ${styles.flag || ''}`}></span>
      )}
    </span>
  );
};


const Option = ({ props }: {props: TOption}) => {
  const { label, value } = props;
  return (
    <div className={styles.optionsContainer}>
      <SelectedRegionIcon regionCode={value.toLowerCase()} />
      <span className={styles.selectLabelText}>{label}</span>
    </div>
  );
};


const CountrySelect = ({ onChangeRegion, regions, selectedRegion }: TProps) => {
  const { t } = useTranslation();

  // find and pass the default object, react-select requires object identity matching, not just value equality
  const defaultValue = regions.find(region => region.value === selectedRegion);
  return (
    <Dropdown
      value={defaultValue}
      className={styles.select}
      renderOptions={(o) => <Option props={o} />}
      isSearchable={true}
      onChange={onChangeRegion}
      options={[{
        label: t('buy.exchange.selectRegion') || '',
        value: '',
      },
      ...regions]}
    />
  );
};

export { CountrySelect };
