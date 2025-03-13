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
import { IAccount } from '@/api/account';

type TProps = {
  account: IAccount;
  onAgreedTerms: () => void;
}

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
  // TODO: update with Bitrefill text
  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.btcdirectWidget.disclaimer.title', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </h2>
        <p>{t('buy.exchange.infoContent.btcdirectWidget.disclaimer.description')}</p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.btcdirectWidget.disclaimer.paymentMethods.title')}
        </h2>
        <ul>
          <li>
            <p>{t('buy.exchange.infoContent.btcdirectWidget.disclaimer.paymentMethods.buy')}</p>
          </li>
        </ul>
        <p>{t('buy.exchange.infoContent.btcdirectWidget.disclaimer.paymentMethods.note')}</p>
        <p>
          <A href={getBitrefillPrivacyLink()}>
            {t('buy.exchange.infoContent.btcdirectWidget.learnmore')}
          </A>
        </p>
        <h2 className={style.title}>
          {t('buy.exchange.infoContent.btcdirectWidget.disclaimer.security.title')}
        </h2>
        <p>{t('buy.exchange.infoContent.btcdirectWidget.disclaimer.security.description')}</p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.exchange.infoContent.btcdirectWidget.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.text')}</p>
        <p>
          <A href={getBitrefillPrivacyLink()}>
            {t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.link')}
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