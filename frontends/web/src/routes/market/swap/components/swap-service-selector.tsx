// SPDX-License-Identifier: Apache-2.0

import Select, { components, SingleValueProps, OptionProps, DropdownIndicatorProps } from 'react-select';
import type { TAmountWithConversions } from '@/api/account';
import { Label } from '@/components/forms';
import { ChevronDownDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { SwapServiceLogo } from './swap-service-logo';
import style from './swap-service-selector.module.css';

type TOption<T = any> = {
  amount: TAmountWithConversions;
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
        <AmountWithUnit amount={data.amount} />
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
  const options: TOption<string>[] = [{
    amount: {
      amount: '0.04',
      unit: 'BTC',
      estimated: false,
      conversions: {
        BTC: '0.005',
        AUD: '512',
        BRL: '512',
        CAD: '512',
        CHF: '512',
        CNY: '512',
        CZK: '512',
        EUR: '512',
        GBP: '512',
        HKD: '512',
        ILS: '512',
        JPY: '512',
        KRW: '512',
        NOK: '512',
        PLN: '512',
        RUB: '512',
        sat: '512',
        SEK: '512',
        SGD: '512',
        USD: '512',
      }
    },
    icon: '',
    label: 'Thorchain',
    isRecommended: true,
    isFast: false,
    value: 'thorchain'
  }, {
    amount: {
      amount: '0.03',
      unit: 'BTC',
      estimated: false,
      conversions: {
        BTC: '0.005',
        AUD: '512',
        BRL: '512',
        CAD: '512',
        CHF: '512',
        CNY: '512',
        CZK: '512',
        EUR: '512',
        GBP: '512',
        HKD: '512',
        ILS: '512',
        JPY: '512',
        KRW: '512',
        NOK: '512',
        PLN: '512',
        RUB: '512',
        sat: '512',
        SEK: '512',
        SGD: '512',
        USD: '512',
      }
    },
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
