// SPDX-License-Identifier: Apache-2.0

import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { setConfig } from '@/utils/config';
import { Button, Checkbox } from '@/components/forms';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';

type TProps = {
  onAgreedTerms: () => void;
};

export const SwapkitTerms = ({ onAgreedTerms }: TProps) => {
  const { t } = useTranslation();
  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipSwapkitDisclaimer: e.target.checked } });
  };

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
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

      </div>
      <div className="text-center m-bottom-quarter">
        <Checkbox
          id="skip_disclaimer"
          label={t('buy.info.skip')}
          onChange={handleSkipDisclaimer} />
      </div>
      <div className="buttons text-center m-bottom-xlarge">
        <Button
          primary
          data-testid="agree-swap-terms"
          onClick={onAgreedTerms}>
          {t('buy.info.continue')}
        </Button>
      </div>
    </div>
  );
};
