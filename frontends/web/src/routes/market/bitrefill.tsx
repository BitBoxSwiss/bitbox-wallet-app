// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { MarketGuide } from './guide';
import { AccountCode, TAccount, proposeTx, sendTx, TTxInput, TTxProposalResult } from '@/api/account';
import { findAccount, isBitcoinOnly } from '@/routes/account/utils';
import { useDarkmode } from '@/hooks/darkmode';
import { useConfig } from '@/contexts/ConfigProvider';
import { i18n } from '@/i18n/i18n';
import { alertUser } from '@/components/alert/Alert';
import { parseExternalBtcAmount } from '@/api/coins';
import { BitrefillTerms, localeMapping } from '@/components/terms/bitrefill-terms';
import { getBitrefillInfo } from '@/api/market';
import { getURLOrigin } from '@/utils/url';
import { ConfirmBitrefill } from './bitrefill-confirm';
import { AppContext } from '@/contexts/AppContext';
import { useMarketIframeActive } from '@/hooks/vendor-iframe-active';
import { useVendorIframeResizeHeight } from '@/hooks/vendor-iframe-resize-height';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import {
  getVendorIframeMessageTarget,
  postMessageToVendorIframe,
  type TVendorIframeMessageTarget,
} from '@/hooks/vendor-iframe-message';
import { useAccountSynced } from '@/hooks/account';
import { useLightning } from '@/hooks/lightning';
import { Send as LightningSend } from '@/routes/lightning/send/send';
import { LightningTestnetGuard } from '@/routes/lightning/testnet-warning';
import style from './iframe.module.css';

// Map coins supported by Bitrefill
const coinMapping: Readonly<Record<string, string>> = {
  btc: 'bitcoin',
  tbtc: 'bitcoin',
  ltc: 'litecoin',
  eth: 'ethereum',
  usdt: 'usdt_erc20',
  usdc: 'usdc_erc20',
  lightning: 'lightning',
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
  const { config } = useConfig();
  const { isDarkMode } = useDarkmode();
  const { isDevServers } = useContext(AppContext);
  const { lightningAccount } = useLightning();
  const account = findAccount(accounts, code);
  const isLightningAccount = lightningAccount?.code === code;
  const coinCode = isLightningAccount ? 'lightning' : account?.coinCode;
  const paymentMethod = coinCode && coinMapping[coinCode];

  const fetchBitrefillInfo = useCallback(() => getBitrefillInfo('spend', code), [code]);
  const bitrefillInfo = useAccountSynced(code, fetchBitrefillInfo);
  const { containerRef, height, iframeLoaded, iframeRef, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorTerms(config?.frontend.skipBitrefillWidgetDisclaimer ?? false);

  const [pendingPayment, setPendingPayment] = useState<boolean>(false);
  const [lightningPaymentInput, setLightningPaymentInput] = useState<string>();
  const [verifyPaymentRequest, setVerifyPaymentRequest] = useState<TTxProposalResult & { address: string } | false>(false);
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  useMarketIframeActive(!lightningPaymentInput && !!paymentMethod && !!config && agreedTerms && bitrefillInfo?.success === true);

  const closeLightningPayment = useCallback((error?: string) => {
    setLightningPaymentInput(undefined);
    setPendingPayment(false);
    if (error) {
      alertUser(error);
    }
  }, []);

  const handleConfiguration = useCallback(async (target: TVendorIframeMessageTarget) => {
    if (
      !paymentMethod
      || !bitrefillInfo?.success
    ) {
      return;
    }
    postMessageToVendorIframe(target, {
      event: 'configuration',
      ref: bitrefillInfo.ref,
      utm_source: 'BITBOX',
      theme: isDarkMode ? 'dark' : 'light',
      hl: i18n.resolvedLanguage ? localeMapping[i18n.resolvedLanguage] : 'en',
      paymentMethods: paymentMethod,
      refundAddress: bitrefillInfo.address,
      // Option to keep pending payment information longer in session, defaults to 'false'
      paymentPending: 'true',
      region, // can be an empty string if user didnt select a region in market
      // Option to show payment information in the widget, defaults to 'true'
      showPaymentInfo: 'true'
    });
  }, [paymentMethod, bitrefillInfo, isDarkMode, region]);

  const handlePaymentRequest = useCallback(async (event: MessageEvent) => {
    if (!paymentMethod || pendingPayment) {
      return;
    }
    setPendingPayment(true);

    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    // User clicked "Pay" in checkout
    const {
      invoiceId,
      paymentMethod: requestedPaymentMethod,
      paymentAmount,
      paymentAddress,
    } = data;

    // Ensure expected payment method matches the selected wallet.
    if (paymentMethod !== requestedPaymentMethod) {
      alertUser(t('unknownError', { errorMessage: 'Payment method mismatch' }));
      setPendingPayment(false);
      return;
    }
    if (isLightningAccount) {
      const invoice = paymentAddress || data.paymentUri;
      if (typeof invoice !== 'string' || !invoice.trim()) {
        alertUser(t('error.lightningInvalidPaymentInput'));
        setPendingPayment(false);
        return;
      }
      setLightningPaymentInput(invoice);
      return;
    }

    const parsedAmount = await parseExternalBtcAmount(paymentAmount.toString());
    if (!parsedAmount.success) {
      alertUser(t('unknownError', { errorMessage: 'Invalid amount' }));
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
  }, [paymentMethod, isLightningAccount, code, pendingPayment, t]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (!bitrefillInfo?.success) {
      return;
    }

    const target = getVendorIframeMessageTarget(event, iframeRef.current);
    const fromWrapper = target && (isDevServers || target.origin === getURLOrigin(bitrefillInfo.url));
    // Bitrefill sends payments to window.top, bypassing the wrapper. Bind those
    // messages to its current inner iframe as well as the Bitrefill origin.
    const wrapper = iframeRef.current?.contentWindow;
    const fromBitrefill = (
      event.origin === getURLOrigin(bitrefillInfo.widgetUrl)
      && wrapper && wrapper.length > 0 && event.source === wrapper[0]
    );
    if (!fromWrapper && !fromBitrefill) {
      return;
    }

    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    switch (data.event) {
    case 'request-configuration': {
      if (fromWrapper) {
        handleConfiguration(target);
      }
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
  }, [bitrefillInfo, handleConfiguration, handlePaymentRequest, iframeRef, isDevServers]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  if (!coinCode || !config) {
    return null;
  }

  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const title = t('generic.spend', { context: translationContext });

  return (
    <>
      {/* Keep the checkout iframe mounted so its order and confirmation survive payment. */}
      <div className="contentWithGuide" style={{ display: lightningPaymentInput ? 'none' : undefined }}>
        <div className="container">
          <div className="innerContainer">
            <div className={style.header}>
              {!lightningPaymentInput && <Header variant="navigation" mobileBackButton title={title} />}
            </div>
            <div ref={containerRef} className={style.container}>
              { !agreedTerms ? (
                <BitrefillTerms
                  coinCode={coinCode}
                  onAgreedTerms={() => setAgreedTerms(true)}
                />
              ) : (
                <div style={{ height }}>
                  {!iframeLoaded && (
                    <Spinner text={t('loading')} />
                  )}
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
        {!lightningPaymentInput && <MarketGuide vendor="bitrefill" translationContext={translationContext} />}
      </div>
      {lightningPaymentInput && (
        <LightningTestnetGuard active>
          <LightningSend
            activeAccounts={accounts}
            initialPaymentInput={lightningPaymentInput}
            onClose={closeLightningPayment}
          />
        </LightningTestnetGuard>
      )}
    </>
  );
};
