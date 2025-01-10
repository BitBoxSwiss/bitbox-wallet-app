/**
 * Copyright 2025 Shift Crypto AG
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

import { useState, useEffect, createRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoonpayBuyInfo } from '@/api/exchanges';
import { AppContext } from '@/contexts/AppContext';
import { AccountCode, getReceiveAddressList, IAccount } from '@/api/account';
import { useLoad } from '@/hooks/api';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { getConfig } from '@/utils/config';
import { debug } from '@/utils/env';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { findAccount, getCoinCode, isBitcoinOnly } from '@/routes/account/utils';
import { BTCDirectTerms } from '@/components/terms/btcdirect-terms';
import { ExchangeGuide } from './guide';
import style from './iframe.module.css';

// Map languages supported by BTC Direct
const localeMapping: Readonly<Record<string, string>> = {
  de: 'de-AT',
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  nl: 'nl-NL',
};

type TProps = {
  accounts: IAccount[];
  code: AccountCode;
}

export const BTCDirect = ({ accounts, code }: TProps) => {
  const { i18n, t } = useTranslation();
  const { isTesting } = useContext(AppContext);
  const { isDarkMode } = useDarkmode();

  const receiveAddresses = useLoad(getReceiveAddressList(code));

  // TODO: address should probably come from the backend, i.e. ETH address
  const p2wpkhAddresses = receiveAddresses?.find(({ scriptType }) => scriptType === 'p2wpkh')?.addresses || [];
  const address = p2wpkhAddresses[0]?.address || '';

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [height, setHeight] = useState(0);

  const config = useLoad(getConfig);
  const moonpay = useLoad(getMoonpayBuyInfo(code)); // TODO: getBTCDirectBuyInfo(code)

  const account = findAccount(accounts, code);
  const ref = createRef<HTMLDivElement>();
  let resizeTimerID: any;

  useEffect(() => {
    if (config) {
      setAgreedTerms(config.frontend.skipBTCDirectDisclaimer);
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

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const locale = i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en-GB';

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header title={
              <h2>
                {t('generic.buy', { context: translationContext })}
              </h2>
            } />
          </div>
          <div ref={ref} className={style.container}>
            { !agreedTerms ? (
              <BTCDirectTerms
                account={account}
                onAgreedTerms={() => setAgreedTerms(true)}
              />
            ) : (
              <div style={{ height }}>
                <UseDisableBackButton />
                {!iframeLoaded && <Spinner text={t('loading')} />}
                { address && moonpay && (
                  <iframe
                    onLoad={() => {
                      setIframeLoaded(true);
                      onResize();
                    }}
                    title="BTC Direct"
                    width="100%"
                    height={height}
                    frameBorder="0"
                    className={`${style.iframe} ${!iframeLoaded ? style.hide : ''}`}
                    allow="camera"
                    data-locale={locale}
                    data-theme={isDarkMode ? 'dark' : 'light'}
                    data-base-currency={getCoinCode(account.coinCode)}
                    data-quote-currency={'EUR'}
                    data-address={address}
                    data-mode={
                      isTesting || debug ? 'debug' : 'production'
                    }
                    data-api-key={
                      // TODO: apiKey should come from the backend
                      isTesting
                        ? '6ed4d42bd02eeac1776a6bb54fa3126f779c04d5c228fe5128bb74e89ef61f83'
                        : '7d71f633626901d5c4d06d91f7d0db2c15cdf524ddd0ebcd36f4d9c4e04694cd'
                    }
                    src="/btcdirect/fiat-to-coin.html">
                  </iframe>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ExchangeGuide exchange="btcdirect" translationContext={translationContext} />
    </div>
  );
};
