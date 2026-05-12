// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout';
import { MobileHeader } from '../settings/components/mobile-header';
import { Spinner } from '@/components/spinner/Spinner';
import { MarketGuide } from './guide';
import { AccountCode, TAccount, proposeTx, sendTx, TTxInput, TTxProposalResult } from '@/api/account';
import { findAccount, isBitcoinOnly } from '@/routes/account/utils';
import { useDarkmode } from '@/hooks/darkmode';
import { getConfig } from '@/utils/config';
import { i18n } from '@/i18n/i18n';
import { alertUser } from '@/components/alert/Alert';
import { parseExternalBtcAmount } from '@/api/coins';
import { useLoad } from '@/hooks/api';
import { BitrefillTerms, localeMapping } from '@/components/terms/bitrefill-terms';
import { getBitrefillInfo } from '@/api/market';
import { getURLOrigin } from '@/utils/url';
import { ConfirmBitrefill } from './bitrefill-confirm';
import { AppContext } from '@/contexts/AppContext';
import { useVendorIframeResizeHeight, useVendorTerms } from '@/hooks/vendor-iframe';
import style from './iframe.module.css';

// Map coins supported by Bitrefill
const coinMapping: Readonly<Record<string, string>> = {
  btc: 'bitcoin',
  tbtc: 'bitcoin',
  ltc: 'litecoin',
  eth: 'ethereum',
  usdt: 'usdt_erc20',
  usdc: 'usdc_erc20',
};

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
  region: string;
};

export const Bitrefill = ({
  accounts,
  code,
  region,
}: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const { isDevServers } = useContext(AppContext);
  const account = findAccount(accounts, code);

  const bitrefillInfo = useLoad(() => getBitrefillInfo('spend', code));

  const config = useLoad(getConfig);
  const { containerRef, height, iframeLoaded, iframeRef, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorTerms(!!config?.frontend?.skipBitrefillWidgetDisclaimer);

  const [pendingPayment, setPendingPayment] = useState<boolean>(false);
  const [verifyPaymentRequest, setVerifyPaymentRequest] = useState<TTxProposalResult & { address: string } | false>(false);

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const handleConfiguration = useCallback(async (event: MessageEvent) => {
    if (
      !account
      || !bitrefillInfo?.success
    ) {
      return;
    }
    event.source?.postMessage({
      event: 'configuration',
      ref: bitrefillInfo.ref,
      utm_source: 'BITBOX',
      theme: isDarkMode ? 'dark' : 'light',
      hl: i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en',
      paymentMethods: account.coinCode ? coinMapping[account.coinCode] : 'bitcoin',
      refundAddress: bitrefillInfo.address,
      // Option to keep pending payment information longer in session, defaults to 'false'
      paymentPending: 'true',
      region, // can be an empty string if user didnt select a region in market
      // Option to show payment information in the widget, defaults to 'true'
      showPaymentInfo: 'true'
    }, {
      targetOrigin: event.origin
    });
  }, [account, bitrefillInfo, isDarkMode, region]);

  const handlePaymentRequest = useCallback(async (event: MessageEvent) => {
    if (!account || pendingPayment) {
      return;
    }
    setPendingPayment(true);

    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    // User clicked "Pay" in checkout
    const {
      invoiceId,
      paymentMethod,
      paymentAmount,
      paymentAddress,
    } = data;

    const parsedAmount = await parseExternalBtcAmount(paymentAmount.toString());
    if (!parsedAmount.success) {
      alertUser(t('unknownError', { errorMessage: 'Invalid amount' }));
      setPendingPayment(false);
      return;
    }
    // Ensure expected payment method matches account
    if (coinMapping[account.coinCode] !== paymentMethod) {
      alertUser(t('unknownError', { errorMessage: 'Payment method mismatch' }));
      setPendingPayment(false);
      return;
    }

    const txInput: TTxInput = {
      address: paymentAddress,
      amount: parsedAmount.amount,
      // Always use highest fee rate for Bitrefill spend
      useHighestFee: true,
      sendAll: 'no',
      selectedUTXOs: [],
      paymentRequest: null
    };

    let result = await proposeTx(code, txInput);
    if (result.success) {
      const txNote = t('generic.paymentRequestNote', {
        name: 'Bitrefill',
        orderId: invoiceId,
      });

      setVerifyPaymentRequest({
        address: paymentAddress,
        ...result
      });
      const sendResult = await sendTx(code, txNote);
      setVerifyPaymentRequest(false);
      if (!sendResult.success && !('aborted' in sendResult)) {
        if (sendResult.errorMessage) {
          alertUser(t('unknownError', { errorMessage: sendResult.errorMessage }));
        } else {
          alertUser(t('genericError'));
        }
      }
    } else {
      if (result.errorCode === 'insufficientFunds') {
        alertUser(t('buy.bitrefill.error.' + result.errorCode));
      } else if (result.errorCode) {
        alertUser(t('send.error.' + result.errorCode));
      } else {
        alertUser(t('genericError'));
      }
    }
    setPendingPayment(false);
  }, [account, code, pendingPayment, t]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (
      !bitrefillInfo?.success
      || (
        !isDevServers // if prod check that event is from same origin as bitrefillInfo.url
        && ![getURLOrigin(bitrefillInfo.url), 'https://embed.bitrefill.com'].includes(event.origin))
    ) {
      return;
    }

    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    switch (data.event) {
    case 'request-configuration': {
      handleConfiguration(event);
      break;
    }
    case 'payment_intent': {
      handlePaymentRequest(event);
      break;
    }
    default: {
      break;
    }
    }
  }, [bitrefillInfo, handleConfiguration, handlePaymentRequest, isDevServers]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  if (
    !account
    || !config
    || !bitrefillInfo?.success
    || !bitrefillInfo.address
  ) {
    return null;
  }

  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const title = t('generic.spend', { context: translationContext });

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
              <BitrefillTerms
                account={account}
                onAgreedTerms={() => setAgreedTerms(true)}
              />
            ) : (
              <div style={{ height }}>
                {!iframeLoaded && <Spinner text={t('loading')} />}
                { bitrefillInfo?.success && (
                  <iframe
                    ref={iframeRef}
                    title="Bitrefill"
                    width="100%"
                    height={height}
                    frameBorder="0"
                    className={`${style.iframe || ''} ${!iframeLoaded && style.hide || ''}`}
                    sandbox="allow-same-origin allow-popups allow-scripts allow-forms"
                    src={bitrefillInfo.url}
                    onLoad={() => {
                      onIframeLoad();
                    }}
                  />
                )}
                {verifyPaymentRequest && verifyPaymentRequest.success && (
                  <ConfirmBitrefill
                    isConfirming={verifyPaymentRequest.success}
                    proposedFee={verifyPaymentRequest.fee}
                    proposedAmount={verifyPaymentRequest.amount}
                    recipientAddress={verifyPaymentRequest.address}
                    proposedTotal={verifyPaymentRequest.total}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketGuide vendor="bitrefill" translationContext={translationContext} />
    </div>
  );
};
