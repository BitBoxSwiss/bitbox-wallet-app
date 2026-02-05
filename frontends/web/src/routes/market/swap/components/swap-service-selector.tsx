// SPDX-License-Identifier: Apache-2.0

import Select, { components, SingleValueProps, OptionProps, DropdownIndicatorProps } from 'react-select';
import { Label } from '@/components/forms';
import { ChevronDownDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { SwapServiceLogo } from './swap-service-logo';
import style from './swap-service-selector.module.css';

type TOption<T = any> = {
  amount: string;
  icon: string;
  label: string;
  isFast: boolean;
  isRecommended: boolean;
  value: T;
};

type SwapProviderOptionProps = {
  data: TOption;
};

const SwapProviderOption = ({ data }: SwapProviderOptionProps) => {
  return (
    <>
      <SwapServiceLogo name={data.value} />
      <span>
        <span className={style.serivceName}>
          {data.label}
        </span>
        {data.isRecommended && (
          <Badge type="success">Recommended</Badge>
        )}
        {data.isFast && (
          <Badge type="warning">Fastest</Badge>
        )}
      </span>
      <span className={style.amount}>
        ({data.amount})
      </span>
    </>
  );
};

// shown when selected
const CustomSingleValue = (props: SingleValueProps<TOption, false>) => {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div className={style.swapServiceOption}>
        <SwapProviderOption data={data} />
      </div>
    </components.SingleValue>
  );
};

// shown in dropdown
const CustomOption = (props: OptionProps<TOption, false>) => {
  const { data, innerProps, isFocused, isSelected } = props;

  return (
    <div
      {...innerProps}
      className={`
        ${style.customOption || ''}
        ${isFocused && style.customOptionFocused || ''}
        ${isSelected && style.customOptionSelected || ''}
      `}
    >
      <div className={style.swapServiceOption}>
        <SwapProviderOption data={data} />
      </div>
    </div>
  );
};

const DropdownIndicator = (props: DropdownIndicatorProps<TOption>) => (
  <components.DropdownIndicator {...props}>
    <ChevronDownDark />
  </components.DropdownIndicator>
);

export const SwapServiceSelector = () => {
  const options = [{
    amount: '1.00000000',
    icon: '',
    label: 'Thorchain',
    isRecommended: true,
    isFast: false,
    value: 'thorchain'
  }, {
    amount: '0.03',
    icon: '',
    label: 'NEAR',
    isRecommended: false,
    isFast: true,
    value: 'near'
  }];

  return (
    <section>
      <Label>
        Swapping services
      </Label>
      <Select<TOption>
        className={style.select}
        classNamePrefix="react-select"
        isClearable={false}
        components={{
          IndicatorSeparator: undefined,
          DropdownIndicator,
          Option: CustomOption,
          SingleValue: CustomSingleValue,
        }}
        isSearchable={false}
        options={options}
        onChange={(option) => console.log(option?.value)}
        defaultValue={options[0]}
      />
    </section>
  );
};
