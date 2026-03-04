// SPDX-License-Identifier: Apache-2.0

import Select, { components, SingleValueProps, OptionProps, DropdownIndicatorProps } from 'react-select';
import type { CoinUnit, TAmountWithConversions } from '@/api/account';
import type { TSwapQuoteRoute } from '@/api/swap';
import { Label } from '@/components/forms';
import { ChevronDownDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { SwapServiceLogo } from './swap-service-logo';
import style from './swap-service-selector.module.css';

type TOption = {
  amount: TAmountWithConversions;
  label: string;
  isFast: boolean;
  isRecommended: boolean;
  provider: string;
  value: string;
};

type SwapProviderOptionProps = {
  data: TOption;
};

const SwapProviderOption = ({ data }: SwapProviderOptionProps) => {
  return (
    <>
      <SwapServiceLogo name={data.provider} />
      <span className={style.meta}>
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

type Props = {
  buyUnit: CoinUnit | undefined;
  error?: string;
  isLoading: boolean;
  onChangeRouteId: (routeId: string) => void;
  routes: TSwapQuoteRoute[];
  selectedRouteId?: string;
};

export const SwapServiceSelector = ({
  buyUnit,
  error,
  isLoading,
  onChangeRouteId,
  routes,
  selectedRouteId,
}: Props) => {
  const unit = buyUnit || 'BTC';
  const options: TOption[] = routes.map((route, index) => ({
    amount: {
      amount: route.expectedBuyAmount,
      unit,
      estimated: false,
      conversions: {},
    },
    label: 'NEAR',
    isRecommended: index === 0,
    isFast: false,
    provider: 'near',
    value: route.routeId,
  }));

  const selectedOption = options.find(option => option.value === selectedRouteId) || options[0];
  const hasMultipleRoutes = options.length > 1;

  return (
    <section>
      <Label>
        Swap route
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
        isDisabled={!options.length || !hasMultipleRoutes || isLoading}
        isSearchable={false}
        options={options}
        value={selectedOption}
        onChange={option => option && onChangeRouteId(option.value)}
      />
      {isLoading && (
        <p className={style.statusText}>Fetching routes...</p>
      )}
      {!isLoading && error && (
        <p className={style.errorText}>{error}</p>
      )}
      {!isLoading && !error && options.length === 1 && (
        <p className={style.statusText}>One route available.</p>
      )}
    </section>
  );
};
