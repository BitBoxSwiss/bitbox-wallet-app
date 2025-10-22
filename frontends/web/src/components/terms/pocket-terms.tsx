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
import { Button, Checkbox } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';
import { SimpleMarkup } from '@/utils/markup';

type TProps = {
  onAgreedTerms: () => void;
}

export const PocketTerms = ({ onAgreedTerms }: TProps) => {
  const { t } = useTranslation();
  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipPocketDisclaimer: e.target.checked } });
  };

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
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
