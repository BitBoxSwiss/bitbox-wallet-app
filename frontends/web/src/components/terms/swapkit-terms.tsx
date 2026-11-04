// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { Terms, type TTermsProps } from './terms';
import style from './terms.module.css';

type TProps = TTermsProps;

export const SwapkitTerms = ({ readOnly, onContinue }: TProps) => {
  const { t } = useTranslation();

  return (
    <Terms configKey="skipSwapkitDisclaimer" readOnly={readOnly} onContinue={onContinue} testId="agree-swap-terms">
      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.intro.title')}
      </h2>
      <p>
        {t('exchange.swapkit.disclaimer.intro.text')}
      </p>

      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.fees.title')}
      </h2>
      <ul>
        <li><p>{t('exchange.swapkit.disclaimer.fees.text')}</p></li>
      </ul>
      <p>
        {t('exchange.swapkit.disclaimer.fees.note')}
      </p>

      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.slippage.title')}
      </h2>
      <p>
        {t('exchange.swapkit.disclaimer.slippage.text')}
      </p>

      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.security.title')}
      </h2>
      <p>
        {t('exchange.swapkit.disclaimer.security.text')}
      </p>
      <p>
        <A href="https://bitbox.swiss/bitbox02/threat-model/">
          {t('exchange.swapkit.disclaimer.security.link')}
        </A>
      </p>

      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.protocol.title')}
      </h2>
      <p>
        {t('exchange.swapkit.disclaimer.protocol.text')}
      </p>
      <p>
        <A href="https://docs.swapkit.dev/swapkit-api/swap-types">
          {t('exchange.swapkit.disclaimer.protocol.link')}
        </A>
      </p>

      <h2 className={style.title}>
        {t('exchange.swapkit.disclaimer.dataProtection.title')}
      </h2>
      <p>
        {t('exchange.swapkit.disclaimer.dataProtection.text')}
      </p>
      <p>
        <A href="https://swapkit.dev/privacy-policy/">
          {t('exchange.swapkit.disclaimer.dataProtection.link')}
        </A>
      </p>

    </Terms>
  );
};
