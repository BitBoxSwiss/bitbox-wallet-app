// SPDX-License-Identifier: Apache-2.0

import { Trans, useTranslation } from 'react-i18next';
import type { TSwapProviderError } from '@/api/swap';
import { FormattedAmount } from '@/components/amount/amount';
import { getSwapProviderMetadata } from './swap-provider-metadata';
import style from '../swap.module.css';

type TProps = {
  errors: TSwapProviderError[];
  noRouteMessage: string;
};

export const SwapProviderErrors = ({ errors, noRouteMessage }: TProps) => {
  const { t } = useTranslation();
  // A quote with no routes can contain declines from several providers. Collect each provider's amount advice.
  const minimumMessages = [];
  const reduceAmountMessages = [];
  for (const [index, error] of errors.entries()) {
    const provider = getSwapProviderMetadata(error.provider).displayName;
    if (error.errorCode === 'sellAssetAmountTooSmall' && error.minAmount) {
      const { amount, unit } = error.minAmount;
      minimumMessages.push(
        <div key={index}>
          <Trans
            i18nKey="swap.providerError.minimum"
            values={{ provider, unit }}
            components={{
              minimum: <span className={style.minimumAmount} />,
              amount: <FormattedAmount amount={amount} unit={unit} alwaysShowAmounts />,
            }}
          />
        </div>
      );
    } else if (error.errorCode === 'insufficientLiquidity' || error.errorCode === 'estimatedTimeTooLong') {
      reduceAmountMessages.push(<div key={index}>{t('swap.providerError.reduceAmount', { provider })}</div>);
    }
  }

  // Show exact minimums before suggestions to try a smaller amount, regardless of provider order.
  if (minimumMessages.length || reduceAmountMessages.length) {
    return <>{minimumMessages}{reduceAmountMessages}</>;
  }

  // Without amount advice, the first matching fallback supplies one message for the whole quote.
  const codes = errors.map(error => error.errorCode);
  if (codes.includes('sellAssetAmountTooSmall')) {
    // This provider gave no usable minimum, so keep the quote's existing no-route guidance.
    return noRouteMessage;
  }
  if (codes.includes('swapHalted')) {
    return t('swap.providersUnavailable');
  }
  if (codes.some(code => ['invalidAsset', 'invalidChain', 'unsupportedChainId', 'unsupportedMethod'].includes(code))) {
    return noRouteMessage;
  }
  return t('swap.fetchQuotesError');
};
