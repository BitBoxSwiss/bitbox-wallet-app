// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RequestAddressV0Message, MessageVersion, parseMessage, serializeMessage, V0MessageType, PaymentRequestV0Message } from 'request-address';
import { useConfig } from '@/contexts/ConfigProvider';
import { Dialog } from '@/components/dialog/dialog';
import { confirmation } from '@/components/confirm/Confirm';
import { verifyAddress, getPocketURL, TMarketAction } from '@/api/market';
import { AccountCode, getInfo, getTransactionList, hasPaymentRequest, signBTCMessageUnusedAddress, proposeTx, sendTx, TTxInput } from '@/api/account';
import { Header } from '@/components/layout';
import { MobileHeader } from '../settings/components/mobile-header';
import { Spinner } from '@/components/spinner/Spinner';
import { PointToBitBox02 } from '@/components/icon';
import { PocketTerms } from '@/components/terms/pocket-terms';
import { useLoad } from '@/hooks/api';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { alertUser } from '@/components/alert/Alert';
import { MarketGuide } from './guide';
import { convertScriptType } from '@/utils/request-addess';
import { parseExternalBtcAmount } from '@/api/coins';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import { useVendorIframeResizeHeight, useVendorTerms } from '@/hooks/vendor-iframe';
import style from './iframe.module.css';

type TProps = {
  action: TMarketAction;
  code: AccountCode;
};

export const Pocket = ({
  action,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const navigate = useNavigate();

  // Pocket sell only works if the FW supports payment requests
  const hasPaymentRequestResponse = useLoad(() => hasPaymentRequest(code));
  const [fwRequiredDialog, setFwRequiredDialog] = useState(false);

  const [blocking, setBlocking] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [iframeURL, setIframeUrl] = useState('');
  const accountInfo = useLoad(getInfo(code));

  const { containerRef, height, iframeLoaded, iframeRef, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorTerms(Boolean(config?.frontend.skipPocketDisclaimer));
  const signingRef = useRef(false);

  useEffect(() => {
    getPocketURL(action).then(response => {
      if (response.success) {
        setIframeUrl(response.url);
      } else {
        alertUser(t('unknownError', { errorMessage: response.errorMessage }));
      }
    });
  }, [action, t]);

  useEffect(() => {
    // enable paymentRequestError only when the action is sell.
    if (action === 'sell' && hasPaymentRequestResponse?.success === false) {
      if (hasPaymentRequestResponse?.errorCode === 'firmwareUpgradeRequired') {
        setFwRequiredDialog(true);
      } else if (hasPaymentRequestResponse?.errorCode) {
        alertUser(t('device.' + hasPaymentRequestResponse.errorCode));
      } else if (hasPaymentRequestResponse?.errorMessage) {
        alertUser(hasPaymentRequestResponse?.errorMessage);
      }
    }
  }, [action, hasPaymentRequestResponse, t]);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  });

  const sendAddress = (address: string, sig: string, correlationId?: string) => {
    const { current } = iframeRef;

    if (!current) {
      return;
    }

    const message = serializeMessage({
      version: MessageVersion.V0,
      type: V0MessageType.Address,
      correlationId,
      bitcoinAddress: address,
      signature: sig,
    });

    current.contentWindow?.postMessage(message, '*');
  };

  const sendPaymentTxId = (txid: string, correlationId?: string) => {
    if (!iframeRef.current) {
      return;
    }

    const message = serializeMessage({
      version: MessageVersion.V0,
      type: V0MessageType.Payment,
      correlationId,
      txid,
    });

    iframeRef.current.contentWindow?.postMessage(message, '*');
  };

  const sendCanceledMessage = (reason: string, correlationId?: string) => {
    if (!iframeRef.current) {
      return;
    }

    const message = serializeMessage({
      version: MessageVersion.V0,
      type: V0MessageType.Cancel,
      correlationId,
      reason,
    });

    iframeRef.current.contentWindow?.postMessage(message, '*');
  };

  const handleRequestAddress = (message: RequestAddressV0Message) => {
    signingRef.current = true;
    const addressType = message.withScriptType ? convertScriptType(message.withScriptType) : '';
    const withMessageSignature = message.withMessageSignature ? message.withMessageSignature : '';
    signBTCMessageUnusedAddress(
      code,
      addressType,
      withMessageSignature)
      .then(response => {
        signingRef.current = false;
        if (response.success) {
          sendAddress(response.address, response.signature, message.correlationId);
        } else {
          if (response.errorCode !== 'userAbort') {
            alertUser(t('unknownError', { errorMessage: response.errorMessage }));
            console.log('error: ' + response.errorMessage);
          }
        }
      });

  };

  const handleVerifyAddress = (address: string) => {
    setVerifying(true);
    verifyAddress(address, code)
      .then(response => {
        setVerifying(false);
        if (!response.success) {
          if (response.errorCode === 'addressNotFound') {
            // This should not happen, unless the user receives a tx on the same address between the message signing
            // and the address verification.
            alertUser(t('buy.pocket.usedAddress', { address:  address }));
          } else {
            alertUser(t('unknownError', { errorMessage: response.errorMessage }));
            console.log('error: ' + response.errorMessage);
          }
        }
      });
  };

  const sendXpub = (correlationId?: string) => {
    if (accountInfo) {
      const bitcoinSimple = accountInfo.signingConfigurations[0]?.bitcoinSimple;
      if (bitcoinSimple) {
        const xpub = bitcoinSimple.keyInfo.xpub;
        const { current } = iframeRef;
        if (!current) {
          return;
        }
        const message = serializeMessage({
          version: MessageVersion.V0,
          type: V0MessageType.ExtendedPublicKey,
          extendedPublicKey: xpub,
          correlationId,
        });
        current.contentWindow?.postMessage(message, '*');
      }
    }
  };

  const handleRequestXpub = (correlationId?: string) => {
    getTransactionList(code).then(txs => {
      if (!txs.success) {
        alertUser(t('transactions.errorLoadTransactions'));
        return;
      }
      if (txs.list.length > 0) {
        confirmation(t('buy.pocket.previousTransactions'), result => {
          if (result) {
            sendXpub(correlationId);
          }
        });
      } else {
        sendXpub(correlationId);
      }
    });
  };

  const handlePaymentRequest = async (message: PaymentRequestV0Message) => {
    if (!message.slip24) {
      alertUser(t('unknownError', { errorMessage: 'Missing payment request data' }));
      return;
    }

    // this allows to correctly handle sats mode
    const parsedAmount = await parseExternalBtcAmount(message.amount.toString());
    if (!parsedAmount.success) {
      sendCanceledMessage('invalid_amount', message.correlationId);
      alertUser(t('unknownError', { errorMessage: 'Invalid amount' }));
      return;
    }

    const txInput: TTxInput = {
      address: message.bitcoinAddress,
      amount: parsedAmount.amount,
      // Always use the highest fee rate for Pocket sell
      useHighestFee: true,
      sendAll: 'no',
      selectedUTXOs: [],
      paymentRequest: message.slip24
    };

    let result = await proposeTx(code, txInput);
    if (result.success) {
      let txNote = t('buy.pocket.paymentRequestNote') + ' ' + message.slip24.recipientName;
      setBlocking(true);
      const sendResult = await sendTx(code, txNote);
      setBlocking(false);
      if (sendResult.success) {
        sendPaymentTxId(sendResult.txId, message.correlationId);
      } else {
        if ('aborted' in sendResult) {
          sendCanceledMessage('rejected_by_customer', message.correlationId);
        } else {
          sendCanceledMessage('unknown_error', message.correlationId);
          if (sendResult.errorMessage) {
            alertUser(t('unknownError', { errorMessage: sendResult.errorMessage }));
          } else {
            alertUser(t('genericError'));
          }
        }
      }
    } else {
      if (result.errorCode === 'insufficientFunds') {
        alertUser(t('buy.pocket.error.' + result.errorCode));
      } else if (result.errorCode) {
        alertUser(t('send.error.' + result.errorCode));
      } else {
        alertUser(t('genericError'));
      }
    }
  };

  const onMessage = (m: MessageEvent) => {
    if (!iframeURL || !code) {
      return;
    }
    // verify the origin of the received message
    if (m.origin !== new URL(iframeURL).origin) {
      return;
    }

    // handle requests from Pocket
    try {
      const message = parseMessage(m.data);
      switch (message.type) {
      case V0MessageType.RequestAddress:
        if (!signingRef.current) {
          handleRequestAddress(message);
        }
        break;
      case V0MessageType.VerifyAddress:
        if (!verifying) {
          handleVerifyAddress(message.bitcoinAddress);
        }
        break;
      case V0MessageType.RequestExtendedPublicKey:
        handleRequestXpub(message.correlationId);
        break;
      case V0MessageType.PaymentRequest:
        handlePaymentRequest(message);
        break;
      case V0MessageType.Close:
        navigate(`/account/${code}`, { replace: true });
        break;
      }
    } catch (e) {
      console.log(e);
      // ignore messages that could not be parsed
      // probably not intended for us, anyway
    }
  };

  const title = t('generic.buySell');

  return (
    <div className="contentWithGuide">
      <div className="container">
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
            <PocketTerms
              onAgreedTerms={() => setAgreedTerms(true)}
            />
          ) : (
            <div style={{ height }}>
              <UseDisableBackButton />
              {!iframeLoaded && <Spinner text={t('loading')} /> }
              {blocking && (
                <div className={style.blocking}></div>
              )}
              <iframe
                onLoad={() => {
                  onIframeLoad();
                }}
                ref={iframeRef}
                title="Pocket"
                width="100%"
                height={height}
                frameBorder="0"
                className={style.iframe}
                allow="camera; payment; clipboard-write;"
                src={iframeURL}>
              </iframe>
            </div>
          )}
          <Dialog
            open={verifying}
            title={t('receive.verifyBitBox02')}
            medium>
            {t('buy.pocket.verifyBitBox02')}
            <PointToBitBox02 />
          </Dialog>
          <FirmwareUpgradeRequiredDialog
            open={fwRequiredDialog}
            onClose={() => {
              setFwRequiredDialog(false);
              navigate(-1);
            }}
          />
        </div>
      </div>
      <MarketGuide vendor="pocket" translationContext="bitcoin" />
    </div>
  );
};
