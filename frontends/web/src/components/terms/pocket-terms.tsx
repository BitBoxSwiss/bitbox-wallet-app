// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { Terms, type TTermsProps } from './terms';
import style from './terms.module.css';
import { SimpleMarkup } from '@/utils/markup';

type TProps = TTermsProps;

export const PocketTerms = ({ readOnly, onContinue }: TProps) => {
  const { t } = useTranslation();

  return (
    <Terms configKey="skipPocketDisclaimer" readOnly={readOnly} onContinue={onContinue}>
      <h2 className={style.title}>{t('exchange.pocket.terms.welcome.title')}</h2>
      <p>{t('exchange.pocket.terms.welcome.p1')}</p>

      <h2 className={style.title}>{t('exchange.pocket.terms.fees.title')}</h2>
      <ul>
        <li><SimpleMarkup tagName="p" markup={t('exchange.pocket.terms.fees.p1')} /></li>
        <li><SimpleMarkup tagName="p" markup={`${t('exchange.pocket.terms.fees.p2')} ${t('exchange.pocket.terms.fees.extraNote')}`} /></li>
      </ul>
      <p>{t('exchange.pocket.terms.fees.note')}</p>

      <h2 className={style.title}>{t('exchange.pocket.terms.security.title')}</h2>
      <p>{t('exchange.pocket.terms.security.p1')}</p>
      <ul>
        <li><SimpleMarkup tagName="p" markup={t('exchange.pocket.terms.security.p2')} /></li>
        <li><SimpleMarkup tagName="p" markup={t('exchange.pocket.terms.security.p3')} /></li>
      </ul>
      <p>
        <A href="https://bitbox.swiss/bitbox02/threat-model/">
          {t('exchange.pocket.terms.security.link')}
        </A>
      </p>

      <h2 className={style.title}>{t('exchange.pocket.terms.kyc.title')}</h2>
      <ul>
        <li><p>{t('exchange.pocket.terms.kyc.info')}</p></li>
      </ul>
      <p>
        <A href="https://pocketbitcoin.com/faq">
          {t('exchange.pocket.terms.kyc.link')}
        </A>
      </p>

      <h2 className={style.title}>{t('exchange.pocket.terms.dataprotection.title')}</h2>
      <p>{t('exchange.pocket.terms.dataprotection.p1')}</p>
      <p>
        <A href="https://pocketbitcoin.com/policy/privacy">
          {t('exchange.pocket.terms.dataprotection.link')}
        </A>
      </p>
    </Terms>
  );
};
