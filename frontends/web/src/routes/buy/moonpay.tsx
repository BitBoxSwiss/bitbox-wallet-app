/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { useState, useEffect, createRef, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../hooks/api';
import { IAccount } from '../../api/account';
import { getConfig } from '../../api/backend';
import { getMoonpayBuyInfo } from '../../api/exchanges';
import Guide from './guide';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { findAccount, getCryptoName } from '../account/utils';
import { Button, Checkbox } from '../../components/forms';
import { setConfig } from '../../utils/config';
import A from '../../components/anchor/anchor';
import style from './moonpay.module.css';

type TProps = {
    accounts: IAccount[];
    code: string;
}

export const Moonpay = ({ accounts, code }: TProps) => {
  const { t } = useTranslation();
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [height, setHeight] = useState(0);

  const config = useLoad(getConfig);
  const moonpay = useLoad(getMoonpayBuyInfo(code));

  const account = findAccount(accounts, code);
  const name = getCryptoName(t('buy.info.crypto'), account);
  const ref = createRef<HTMLDivElement>();
  let resizeTimerID: any;

  useEffect(() => {
    if (config) {
      setAgreedTerms(config.frontend.skipBuyDisclaimer);
    }
  }, [config]);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  });

  const handleSkipDisclaimer = (e: ChangeEvent<HTMLInputElement>) => {
    setConfig({ frontend: { skipBuyDisclaimer: e.target.checked } });
  };

  const onResize = () => {
    if (resizeTimerID) {
      clearTimeout(resizeTimerID);
    }
    resizeTimerID = setTimeout(() => {
      if (!ref.current) {
        return;
      }
      setHeight(ref.current.offsetHeight);
    }, 200);
  };

  if (!account || !config) {
    return null;
  }

  return (

    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
          </div>
          { !agreedTerms ? (
            <div className={style.disclaimerContainer}>
              <div className={style.disclaimer}>
                <h2 className={style.title}>
                  {t('buy.info.disclaimer.title', { name })}
                </h2>
                <p>{t('buy.info.disclaimer.intro.0', { name })}</p>
                <p>{t('buy.info.disclaimer.intro.1', { name })}</p>
                <h2 className={style.title}>
                  {t('buy.info.disclaimer.payment.title')}
                </h2>
                <p>{t('buy.info.disclaimer.payment.details', { name })}</p>
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
                <p>{t('buy.info.disclaimer.security.description', { name })}</p>
                <p>
                  <A className={style.link} href="https://shiftcrypto.ch/bitbox02/threat-model/">
                    {t('buy.info.disclaimer.security.link')}
                  </A>
                </p>
                <h2 className={style.title}>
                  {t('buy.info.disclaimer.protection.title')}
                </h2>
                <p>{t('buy.info.disclaimer.protection.description', { name })}</p>
                <p>
                  <A className={style.link} href="https://www.moonpay.com/privacy_policy">
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
                  onClick={() => setAgreedTerms(true)}>
                  {t('buy.info.continue')}
                </Button>
              </div>
            </div>
          ) : (
            <div ref={ref} className="iframeContainer">
              {!iframeLoaded && <Spinner text={t('loading')} />}
              { moonpay && (
                <iframe
                  onLoad={() => {
                    setIframeLoaded(true);
                    onResize();
                  }}
                  title="Moonpay"
                  width="100%"
                  height={height}
                  frameBorder="0"
                  className={style.iframe}
                  allow="camera; payment"
                  src={`${moonpay.url}&colorCode=%235E94BF`}>
                </iframe>
              )}
            </div>
          )}
        </div>
      </div>
      <Guide name={name} />
    </div>
  );
};
