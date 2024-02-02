/**
 * Copyright 2023 Shift Crypto AG
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
import { Button, Checkbox } from '../forms';
import { setConfig } from '../../utils/config';
import { A } from '../anchor/anchor';
import style from './terms.module.css';
import { i18n } from '../../i18n/i18n';

type TProps = {
  onAgreedTerms: () => void;
}

export const BitsuranceTerms = ({ onAgreedTerms }: TProps) => {
  const { t } = useTranslation();
  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBitsuranceDisclaimer: e.target.checked } });
  };
  const getPrivacyLink = (): string => {
    switch (i18n.resolvedLanguage) {
    case 'de':
      return 'https://www.bitsurance.eu/datenschutz';
    default:
      return 'https://www.bitsurance.eu/en/dataprotection/';
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
