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

import { useState, useEffect, createRef, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBTCDirectInfo, TExchangeAction } from '@/api/exchanges';
import { parseExternalBtcAmount } from '@/api/coins';
import { AppContext } from '@/contexts/AppContext';
import { AccountCode, IAccount, proposeTx, sendTx, TTxInput } from '@/api/account';
import { useLoad } from '@/hooks/api';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { getConfig } from '@/utils/config';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { findAccount, isBitcoinOnly } from '@/routes/account/utils';
import { BTCDirectTerms } from '@/components/terms/btcdirect-terms';
import { ExchangeGuide } from './guide';
import { alertUser } from '@/components/alert/Alert';
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
  action: TExchangeAction;
  code: AccountCode;
}

const getURLOrigin = (uri: string): string | null => {
  try {
    return new URL(uri).origin;
  } catch (e) {
    return null;
  }
};

export const BTCDirect = ({
  accounts,
  action,
  code,
}: TProps) => {
  const { i18n, t } = useTranslation();
  const { isDevServers } = useContext(AppContext);
  const { isDarkMode } = useDarkmode();
  const navigate = useNavigate();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const btcdirectInfo = useLoad(() => getBTCDirectInfo(action, code));

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [height, setHeight] = useState(0);

  const config = useLoad(getConfig);

  const account = findAccount(accounts, code);
  const ref = createRef<HTMLDivElement>();
  let resizeTimerID: any;

  useEffect(() => {
    if (config) {
      setAgreedTerms(config.frontend.skipBTCDirectWidgetDisclaimer);
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

  const handlePaymentRequest = useCallback(async (event: MessageEvent) => {
    const {
      amount,
      currency,
      orderId,
      walletAddress,
    } = event.data;

    if (!btcdirectInfo || btcdirectInfo?.success === false) {
      if (btcdirectInfo?.errorMessage) {
        console.error(btcdirectInfo.errorMessage);
        alertUser(btcdirectInfo.errorMessage);
      } else {
        alertUser(t('genericError'));
      }
      return;
    }

    let txAmount: string;
    if (currency !== 'BTC') {
      txAmount = String(amount);
    } else {
      // this allows to correctly handle sats mode
      const parsedAmount = await parseExternalBtcAmount(String(amount));
      if (!parsedAmount.success) {
        alertUser(t('unknownError', { errorMessage: 'Invalid amount' }));
        return;
      }
      txAmount = parsedAmount.amount;
    }

    const txInput: TTxInput = {
      address: walletAddress,
      amount: txAmount,
      paymentRequest: null,
      sendAll: 'no',
      selectedUTXOs: [],
      useHighestFee: true,
    };

    const txProposal = await proposeTx(code, txInput);
    if (txProposal.success) {
      const txNote = t('generic.paymentRequestNote', {
        name: 'BTC Direct',
        orderId,
      });
      setBlocking(true);
      const sendResult = await sendTx(code, txNote);
      setBlocking(false);
      if (sendResult.success) {
        const { txId } = sendResult;
        event.source?.postMessage({
          action: 'confirm-transaction-id',
          transactionId: txId
        }, {
          targetOrigin: event.origin
        });
        // stop here and continue in the widget
        return;
      }
      if (!sendResult.success && !('aborted' in sendResult)) {
        alertUser(t('unknownError', { errorMessage: sendResult.errorMessage }));
      }
    } else {
      if (txProposal.errorCode === 'insufficientFunds') {
        alertUser(t('exchange.btcdirect.' + txProposal.errorCode));
      } else if (txProposal.errorCode) {
        alertUser(t('send.error.' + txProposal.errorCode));
      } else {
        alertUser(t('genericError'));
      }
    }

    // cancel the sell order here if txProposal or sendTx was unsuccessful
    event.source?.postMessage({
      action: 'cancel-order',
    }, {
      targetOrigin: event.origin
    });

  }, [code, t, btcdirectInfo]);

  const locale = i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en-GB';

  const handleConfiguration = useCallback((event: MessageEvent) => {
    if (!account || !btcdirectInfo?.success) {
      return;
    }
    event.source?.postMessage({
      action: 'configuration',
      ...(action === 'buy' && {
        address: btcdirectInfo.address
      }),
      locale,
      theme: isDarkMode ? 'dark' : 'light',
      baseCurrency: account.coinUnit,
      quoteCurrency: 'EUR', // BTC Direct currently only accepts EURO
      mode: isDevServers ? 'debug' : 'production',
      apiKey: btcdirectInfo.apiKey,
    }, {
      targetOrigin: event.origin
    });
  }, [account, action, btcdirectInfo, isDarkMode, isDevServers, locale]);

  const onMessage = useCallback((event: MessageEvent) => {
    if (
      !account
      || !btcdirectInfo?.success
      || (
        !isDevServers // if prod check that event is from same origin as btcdirectInfo.url
        && event.origin !== getURLOrigin(btcdirectInfo.url)
      )
    ) {
      return;
    }
    switch (event.data.action) {
    case 'request-configuration':
      handleConfiguration(event);
      break;
    case 'request-payment':
      handlePaymentRequest(event);
      break;
    case 'back-to-app':
      navigate(`/account/${code}`);
      break;
    }

  }, [account, btcdirectInfo, code, isDevServers, navigate, handleConfiguration, handlePaymentRequest]);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  if (!account || !config) {
    return null;
  }

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header title={
              <h2>
                {action === 'buy' ? (
                  t('generic.buy', { context: translationContext })
                ) : (
                  t('generic.sell', { context: translationContext })
                )}
                {}
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
                {blocking && (
                  <div className={style.blocking}></div>
                )}
                { btcdirectInfo?.success ? (
                  <iframe
                    onLoad={() => {
                      setIframeLoaded(true);
                      onResize();
                    }}
                    ref={iframeRef}
                    title="BTC Direct"
                    width="100%"
                    height={height}
                    frameBorder="0"
                    className={`${style.iframe} ${!iframeLoaded ? style.hide : ''}`}
                    allow="camera; clipboard-write;"
                    src={btcdirectInfo.url}>
                  </iframe>
                ) : (
                  <>{btcdirectInfo?.errorMessage ? alertUser(btcdirectInfo.errorMessage) : alertUser('genericError')}</>
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
