/**
 * Copyright 2025 Shift Crypto AG
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
import { ChangeEvent } from 'react';
import { Button, Checkbox } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { i18n } from '@/i18n/i18n';
import { A } from '../anchor/anchor';
import style from './terms.module.css';
import { isBitcoinOnly } from '@/routes/account/utils';
import { TAccount } from '@/api/account';

type TProps = {
  account: TAccount;
  onAgreedTerms: () => void;
};

// Map languages supported by Bitrefill
export const localeMapping: Readonly<Record<string, string>> = {
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  pt: 'pt',
  ja: 'ja',
  zh: 'zh-Hans'
};

export const getBitrefillPrivacyLink = () => {
  const hl = i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en';
  return 'https://www.bitrefill.com/privacy/?hl=' + hl;
};

const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
  setConfig({ frontend: { skipBitrefillWidgetDisclaimer: e.target.checked } });
};

export const BitrefillTerms = ({ account, onAgreedTerms }: TProps) => {
  const { t } = useTranslation();

  const isBitcoin = isBitcoinOnly(account.coinCode);
  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.bitrefill.disclaimer.intro.title', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.intro.text')}</p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.bitrefill.disclaimer.fees.title')}
        </h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.fees.text')}</p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.bitrefill.disclaimer.account.title')}
        </h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.account.text')}</p>
        <p>
          <A href="https://help.bitrefill.com/hc/en-us/articles/360019385360-Is-there-a-purchasing-top-up-limit">
            {t('buy.exchange.infoContent.bitrefill.disclaimer.account.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.bitrefill.disclaimer.security.title')}</h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.security.text')}</p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.exchange.infoContent.bitrefill.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.bitrefill.disclaimer.dataProtection.title')}</h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.dataProtection.text')}</p>
        <p>
          <A href={getBitrefillPrivacyLink()}>
            {t('buy.exchange.infoContent.bitrefill.disclaimer.dataProtection.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.bitrefill.disclaimer.claims.title')}</h2>
        <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.claims.text')}</p>
        <p>
          <A href="https://help.bitrefill.com/">
            {t('buy.exchange.infoContent.bitrefill.disclaimer.claims.link')}
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
          onClick={onAgreedTerms}>
          {t('buy.info.continue')}
        </Button>
      </div>
    </div>
  );
};
