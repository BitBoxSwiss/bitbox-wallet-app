// SPDX-License-Identifier: Apache-2.0
import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { TAccount } from '@/api/account';
import { isBitcoinOnly } from '@/routes/account/utils';
import { getBitrefillHelpLink, getBitrefillLimitsLink } from '@/routes/market/bitrefill-guide';
import { Button, Checkbox } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { A } from '../anchor/anchor';
import style from './terms.module.css';

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
