// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { ChangeEvent } from 'react';
import { Button, Checkbox } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';
import { i18n } from '@/i18n/i18n';

type TProps = {
  onAgreedTerms: () => void;
};

export const BitsuranceTerms = ({ onAgreedTerms }: TProps) => {
  const { t } = useTranslation();
  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBitsuranceDisclaimer: e.target.checked } });
  };
  const getPrivacyLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://www.bitsurance.io/datenschutz';
    default:
      return 'https://www.bitsurance.io/en/dataprotection/';
    }
  };


  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
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
