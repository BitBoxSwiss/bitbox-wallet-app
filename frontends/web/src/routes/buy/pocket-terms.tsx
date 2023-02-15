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
import { Button, Checkbox } from '../../components/forms';
import { setConfig } from '../../utils/config';
import A from '../../components/anchor/anchor';
import style from './terms.module.css';

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
        <h2 className={style.title}>{t('buy.pocket.welcome.title')}</h2>
        <p>{t('buy.pocket.welcome.p1')}</p>
        <p>{t('buy.pocket.welcome.p2')}</p>
        <p>{t('buy.pocket.welcome.p3')}</p>

        <h2 className={style.title}>{t('buy.pocket.payment.title')}</h2>
        <p>{t('buy.pocket.payment.p1')}</p>
        <p>{t('buy.pocket.payment.p2')}</p>

        <h2 className={style.title}>{t('buy.pocket.security.title')}</h2>
        <p>{t('buy.pocket.security.p1')}</p>
        <p>
          <A className={style.link} href="https://shiftcrypto.ch/bitbox02/threat-model/">
            {t('buy.pocket.security.link')}
          </A>
        </p>
        <h2 className={style.title}>{t('buy.pocket.kyc.title')}</h2>
        <p>{t('buy.pocket.kyc.p1')}</p>
        <p>
          <A className={style.link} href="https://pocketbitcoin.com/faq">
            {t('buy.pocket.kyc.link')}
          </A>
        </p>

        <h2 className={style.title}>{t('buy.pocket.data.title')}</h2>
        <p>{t('buy.pocket.data.p1')}</p>
        <p>
          <A className={style.link} href="https://pocketbitcoin.com/policy/privacy">
            {t('buy.pocket.data.link')}
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
