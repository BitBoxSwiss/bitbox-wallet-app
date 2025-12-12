// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isBitcoinOnly } from '@/routes/account/utils';
import { Button, Checkbox } from '@/components/forms';
import { setConfig } from '@/utils/config';
import { TAccount } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import style from './terms.module.css';

type TProps = {
  account: TAccount;
  onAgreedTerms: () => void;
};

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
          {t('buy.info.disclaimer.security.descriptionGeneric', {
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
          {t('buy.info.disclaimer.protection.descriptionGeneric', {
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
