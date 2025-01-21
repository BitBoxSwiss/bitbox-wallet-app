/**
 * Copyright 2024 Shift Crypto AG
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

type TProps = {
  onContinue: () => void;
}

export const BTCDirectOTCTerms = ({ onContinue }: TProps) => {
  const { t } = useTranslation();
  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBTCDirectOTCDisclaimer: e.target.checked } });
  };

  const getPrivacyLink = () => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://btcdirect.eu/de-at/datenschutzenklaerung?BitBox';
    case 'nl':
      return 'https://btcdirect.eu/nl-nl/privacy-policy?BitBox';
    case 'es':
      return 'https://btcdirect.eu/es-es/privacy-policy?BitBox';
    case 'fr':
      return 'https://btcdirect.eu/fr-fr/privacy-policy?BitBox';
    default:
      return 'https://btcdirect.eu/en-eu/privacy-policy?BitBox';
    }
  };

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.partnership.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.partnership.text')}</p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.personal.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.personal.text')}</p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.title')}</h2>
        <ul>
          <li>
            <p>
              <strong>{t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.buy')}</strong>
              &nbsp;
              {t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.buy2')}
            </p>
          </li>
          <li>
            <p>
              <strong>{t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.sell')}</strong>
              &nbsp;
              {t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.sell2')}
            </p>
          </li>
        </ul>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.paymentMethods.fee')}</p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.security.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.security.text')}</p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.exchange.infoContent.btcdirect.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.kyc.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.kyc.text')}</p>
        <h2 className={style.title}>{t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.title')}</h2>
        <p>{t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.text')}</p>
        <p>
          <A href={getPrivacyLink()}>
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
          onClick={onContinue}>
          {t('buy.info.continue')}
        </Button>
      </div>
    </div>
  );
};
