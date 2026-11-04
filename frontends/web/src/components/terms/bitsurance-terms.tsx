// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { Terms, type TTermsProps } from './terms';
import { i18n } from '@/i18n/i18n';

type TProps = TTermsProps;

export const BitsuranceTerms = ({ readOnly, onContinue }: TProps) => {
  const { t } = useTranslation();
  const getPrivacyLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://www.bitsurance.eu/datenschutz';
    default:
      return 'https://www.bitsurance.eu/en/dataprotection/';
    }
  };

  return (
    <Terms configKey="skipBitsuranceDisclaimer" readOnly={readOnly} onContinue={onContinue}>
      <p>{t('bitsurance.terms.text1')}</p>
      <p>{t('bitsurance.terms.text2')}</p>
      <p>{t('bitsurance.terms.text3')}</p>
      <p>{t('bitsurance.terms.text4')}</p>
      <p>
        {t('bitsurance.terms.text5')}
        {' '}
        <A href={getPrivacyLink()}>
          {t('bitsurance.terms.link')}.
        </A>
      </p>
    </Terms>
  );
};
