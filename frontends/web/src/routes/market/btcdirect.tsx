// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBTCDirectInfo, TMarketAction } from '@/api/market';
import { parseExternalBtcAmount } from '@/api/coins';
import { AppContext } from '@/contexts/AppContext';
import { AccountCode, TAccount, proposeTx, sendTx, TTxInput } from '@/api/account';
import { useLoad } from '@/hooks/api';
import { useAccountSynced } from '@/hooks/accounts';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { getConfig } from '@/utils/config';
import { getURLOrigin } from '@/utils/url';
import { Header } from '@/components/layout';
import { MobileHeader } from '../settings/components/mobile-header';
import { Spinner } from '@/components/spinner/Spinner';
import { findAccount, isBitcoinOnly } from '@/routes/account/utils';
import { BTCDirectTerms } from '@/components/terms/btcdirect-terms';
import { MarketGuide } from './guide';
import { alertUser } from '@/components/alert/Alert';
import { useVendorIframeResizeHeight, useVendorTerms } from '@/hooks/vendor-iframe';
import { Message } from '@/components/message/message';
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
  accounts: TAccount[];
  action: TMarketAction;
  code: AccountCode;
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

  const fetchBTCDirectInfo = useCallback(() => getBTCDirectInfo(action, code), [action, code]);
  const btcdirectInfo = useAccountSynced(code, fetchBTCDirectInfo);

  const [blocking, setBlocking] = useState(false);

  const config = useLoad(getConfig);

  const account = findAccount(accounts, code);
  const { containerRef, height, iframeLoaded, iframeRef, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorTerms(!!config?.frontend?.skipBTCDirectWidgetDisclaimer);

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
        if (sendResult.errorMessage) {
          alertUser(t('unknownError', { errorMessage: sendResult.errorMessage }));
        } else {
          alertUser(t('genericError'));
        }
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
  }, [onMessage]);

  if (!account || !config) {
    return null;
  }

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const title = action === 'buy' ? (
    t('generic.buy', { context: translationContext })
  ) : (
    t('generic.sell', { context: translationContext })
  );

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header title={
              <>
                <h2 className="hide-on-small">{title}</h2>
                <MobileHeader withGuide title={title} />
              </>
            } />
          </div>
          <div ref={containerRef} className={style.container}>
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
                      onIframeLoad();
                    }}
                    ref={iframeRef}
                    title="BTC Direct"
                    width="100%"
                    height={height}
                    frameBorder="0"
                    className={`${style.iframe || ''} ${!iframeLoaded && style.hide || ''}`}
                    allow="camera; clipboard-write;"
                    src={btcdirectInfo.url}>
                  </iframe>
                ) : (
                  btcdirectInfo?.success === false && (
                    <Message type="error">
                      {btcdirectInfo?.errorMessage
                        ? btcdirectInfo.errorMessage
                        : t('genericError')}
                    </Message>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketGuide vendor="btcdirect" translationContext={translationContext} />
    </div>
  );
};
