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

import { useState, useEffect, createRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../hooks/api';
import { IAccount } from '../../api/account';
import { getConfig } from '../../api/backend';
import { getMoonpayBuyInfo } from '../../api/exchanges';
import Guide from './guide';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { findAccount, getCryptoName } from '../account/utils';
import { MoonpayTerms } from './moonpay-terms';
import style from './terms.module.css';

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
      setAgreedTerms(config.frontend.skipMoonpayDisclaimer);
    }
  }, [config]);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  });

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
            <MoonpayTerms
              account={account}
              onAgreedTerms={() => setAgreedTerms(true)}
            />
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
