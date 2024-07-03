/**
 * Copyright 2018 Shift Devices AG
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

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isBitcoinOnly } from '../../routes/account/utils';
import { Button, Checkbox } from '../forms';
import { setConfig } from '../../utils/config';
import { IAccount } from '../../api/account';
import { A } from '../anchor/anchor';
import style from './terms.module.css';

type TProps = {
  account: IAccount;
  onAgreedTerms: () => void;
}

export const MoonpayTerms = ({ account, onAgreedTerms }: TProps) => {
  const { t } = useTranslation();

  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipMoonpayDisclaimer: e.target.checked } });
  };

  const coinCode = account.coinCode.toUpperCase();
  const isBitcoin = isBitcoinOnly(account.coinCode);

  return (
    <div className={style.disclaimerContainer}>
      <div className={style.disclaimer}>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.title', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </h2>
        <p>{t('buy.info.disclaimer.intro.0', { coinCode })}</p>
        <p>{t('buy.info.disclaimer.intro.1', { coinCode })}</p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.payment.title')}
        </h2>
        <p>{t('buy.info.disclaimer.payment.details', { coinCode })}</p>
        <div className={style.table}>
          <table>
            <colgroup>
              <col width="*" />
              <col width="50px" />
              <col width="*" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('buy.info.disclaimer.payment.table.method')}</th>
                <th>{t('buy.info.disclaimer.payment.table.fee')}</th>
                <th>{t('buy.info.disclaimer.payment.table.description')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('buy.info.disclaimer.payment.table.1_method')}</td>
                <td className={style.nowrap}>1.9 %</td>
                <td>{t('buy.info.disclaimer.payment.table.1_description')}</td>
              </tr>
              <tr>
                <td>{t('buy.info.disclaimer.payment.table.2_method')}</td>
                <td className={style.nowrap}>4.9 %</td>
                <td>{t('buy.info.disclaimer.payment.table.2_description')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{t('buy.info.disclaimer.payment.footnote')}</p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.security.title')}
        </h2>
        <p>
          {t('buy.info.disclaimer.security.description', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </p>
        <p>
          <A href="https://bitbox.swiss/bitbox02/threat-model/">
            {t('buy.info.disclaimer.security.link')}
          </A>
        </p>
        <h2 className={style.title}>
          {t('buy.info.disclaimer.protection.title')}
        </h2>
        <p>
          {t('buy.info.disclaimer.protection.description', {
            context: isBitcoin ? 'bitcoin' : 'crypto'
          })}
        </p>
        <p>
          <A href="https://www.moonpay.com/privacy_policy">
            {t('buy.info.disclaimer.privacyPolicy')}
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
