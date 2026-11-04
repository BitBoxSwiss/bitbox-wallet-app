// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { A } from '../anchor/anchor';
import { Terms, type TTermsProps } from './terms';
import style from './terms.module.css';

type TProps = TTermsProps;

export const getBTCDirectPrivacyLink = () => {
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

export const BTCDirectOTCTerms = ({ readOnly, onContinue }: TProps) => {
  const { t } = useTranslation();

  return (
    <Terms configKey="skipBTCDirectOTCDisclaimer" readOnly={readOnly} onContinue={onContinue}>
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
        <A href={getBTCDirectPrivacyLink()}>
          {t('buy.exchange.infoContent.btcdirect.disclaimer.dataProtection.link')}
        </A>
      </p>
    </Terms>
  );
};
