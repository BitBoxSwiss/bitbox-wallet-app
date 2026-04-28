// SPDX-License-Identifier: Apache-2.0

import Select, { components, SingleValueProps, OptionProps, DropdownIndicatorProps } from 'react-select';
import { useTranslation } from 'react-i18next';
import type { CoinUnit, TAmountWithConversions } from '@/api/account';
import type { TSwapQuoteRoute } from '@/api/swap';
import { Label } from '@/components/forms';
import { Message } from '@/components/message/message';
import { ChevronDownDark } from '@/components/icon';
import { Badge } from '@/components/badge/badge';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { SwapServiceLogo } from './swap-service-logo';
import { getSwapProviderMetadata } from './swap-provider-metadata';
import style from './swap-service-selector.module.css';

const MAX_VISIBLE_PROVIDER_LOGOS = 3;

type TOption = {
  amount: TAmountWithConversions;
  label: string;
  isFast: boolean;
  isRecommended: boolean;
  providers: string[];
  value: string;
};

type SwapProviderOptionProps = {
  data: TOption;
};

const ProviderLogos = ({ providers }: { providers: string[] }) => {
  const visibleProviders = providers.slice(0, MAX_VISIBLE_PROVIDER_LOGOS);
  const hiddenProvidersCount = Math.max(0, providers.length - MAX_VISIBLE_PROVIDER_LOGOS);

  return (
    <span className={style.logoGroup}>
      {visibleProviders.length > 0 ? visibleProviders.map(provider => (
        <SwapServiceLogo
          key={provider}
          className={style.logo}
          name={provider}
        />
      )) : (
        <SwapServiceLogo className={style.logo} name="" />
      )}
      {hiddenProvidersCount > 0 && (
        <span className={style.logoOverflowBadge}>
          +
          {hiddenProvidersCount}
        </span>
      )}
    </span>
  );
};

const SwapProviderOption = ({ data }: SwapProviderOptionProps) => {
  const { t } = useTranslation();
  return (
    <>
      <ProviderLogos providers={data.providers} />
      <span className={style.meta}>
        <span className={style.serviceName}>
          {data.label}
        </span>
        {data.isRecommended && (
          <Badge type="success">{t('swap.recommended')}</Badge>
        )}
        {data.isFast && (
          <Badge type="warning">{t('swap.fastest')}</Badge>
        )}
      </span>
      <span className={style.amount}>
        <AmountWithUnit
          amount={data.amount}
          maxDecimals={9}
        />
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
      ref={props.innerRef}
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
  const { t } = useTranslation();
  const options: TOption[] = buyUnit ? routes.map((route, index) => ({
    amount: {
      amount: route.expectedBuyAmount,
      unit: buyUnit,
      estimated: false,
      conversions: {},
    },
    label: route.providers
      .map(provider => getSwapProviderMetadata(provider).displayName)
      .filter(displayName => displayName)
      .join(' + ') || t('generic.unknown'),
    isRecommended: index === 0,
    isFast: false,
    providers: route.providers,
    value: route.routeId,
  })) : [];

  const selectedOption = selectedRouteId
    ? options.find(option => option.value === selectedRouteId)
    : undefined;

  return (
    <section>
      <Label>
        {t('swap.route')}
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
        isDisabled={!options.length || isLoading}
        isSearchable={false}
        options={options}
        value={selectedOption}
        onChange={option => option && onChangeRouteId(option.value)}
      />
      {isLoading && (
        <p className={style.statusText}>{t('swap.fetchingRoutes')}</p>
      )}
      {!isLoading && error && (
        <Message
          type="warning"
          className={style.errorMessage}
        >
          {error}
        </Message>
      )}
      {!isLoading && !error && options.length === 1 && (
        <p className={style.statusText}>{t('swap.oneRouteAvailable')}</p>
      )}
    </section>
  );
};
