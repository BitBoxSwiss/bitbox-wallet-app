// SPDX-License-Identifier: Apache-2.0
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { CoinCode } from '@/api/account';
import { isBitcoinOnly } from '@/utils/coin';
import { getBitrefillHelpLink, getBitrefillLimitsLink } from '@/routes/market/bitrefill-guide';
import { A } from '../anchor/anchor';
import { Terms, type TTermsProps } from './terms';
import style from './terms.module.css';

type TProps = TTermsProps & {
  coinCode: CoinCode;
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

export const BitrefillTerms = ({ coinCode, readOnly, onContinue }: TProps) => {
  const { t } = useTranslation();

  const isBitcoin = isBitcoinOnly(coinCode);
  return (
    <Terms configKey="skipBitrefillWidgetDisclaimer" readOnly={readOnly} onContinue={onContinue}>
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
        <A href={getBitrefillLimitsLink()}>
          {t('buy.exchange.infoContent.bitrefill.disclaimer.account.link')}
        </A>
      </p>
      <h2 className={style.title}>
        {t('buy.exchange.infoContent.bitrefill.disclaimer.validEmail.title')}
      </h2>
      <p>{t('buy.exchange.infoContent.bitrefill.disclaimer.validEmail.text')}</p>
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
        <A href={getBitrefillHelpLink()}>
          {t('buy.exchange.infoContent.bitrefill.disclaimer.claims.link')}
        </A>
      </p>
    </Terms>
  );
};
