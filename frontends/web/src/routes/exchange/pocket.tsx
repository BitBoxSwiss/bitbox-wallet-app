/**
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

import { useTranslation } from 'react-i18next';
import { useState, useEffect, createRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequestAddressV0Message, MessageVersion, parseMessage, serializeMessage, V0MessageType, PaymentRequestV0Message } from 'request-address';
import { getConfig } from '@/utils/config';
import { Dialog } from '@/components/dialog/dialog';
import { confirmation } from '@/components/confirm/Confirm';
import { verifyAddress, getPocketURL, TExchangeAction } from '@/api/exchanges';
import { AccountCode, getInfo, getTransactionList, signAddress, proposeTx, sendTx, TTxInput } from '@/api/account';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { PocketTerms } from '@/components/terms/pocket-terms';
import { useLoad } from '@/hooks/api';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { alertUser } from '@/components/alert/Alert';
import { ExchangeGuide } from './guide';
import { convertScriptType } from '@/utils/request-addess';
import style from './iframe.module.css';
import { parseExternalBtcAmount } from '@/api/coins';

interface TProps {
    code: AccountCode;
    action: TExchangeAction;
}

export const Pocket = ({ code, action }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [iframeURL, setIframeUrl] = useState('');
  const config = useLoad(getConfig);
  const accountInfo = useLoad(getInfo(code));

  const ref = createRef<HTMLDivElement>();
  const iframeRef = createRef<HTMLIFrameElement>();
  let signing = false;
  let resizeTimerID: any = undefined;

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
    if (config) {
      setAgreedTerms(config.frontend.skipPocketDisclaimer);
    }
  }, [config]);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('message', onMessage);
    };
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

  const sendAddress = (address: string, sig: string) => {
    const { current } = iframeRef;

    if (!current) {
      return;
    }

    const message = serializeMessage({
      version: MessageVersion.V0,
      type: V0MessageType.Address,
      bitcoinAddress: address,
      signature: sig,
    });

    current.contentWindow?.postMessage(message, '*');
  };

  const handleRequestAddress = (message: RequestAddressV0Message) => {
    signing = true;
    const addressType = message.withScriptType ? convertScriptType(message.withScriptType) : '';
    const withMessageSignature = message.withMessageSignature ? message.withMessageSignature : '';
    signAddress(
      addressType,
      withMessageSignature,
      code)
      .then(response => {
        signing = false;
        if (response.success) {
          sendAddress(response.address, response.signature);
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

  const sendXpub = () => {
    if (accountInfo) {
      const bitcoinSimple = accountInfo.signingConfigurations[0].bitcoinSimple;
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
        });
        current.contentWindow?.postMessage(message, '*');
      }
    }
  };

  const handleRequestXpub = () => {
    getTransactionList(code).then(txs => {
      if (!txs.success) {
        alertUser(t('transactions.errorLoadTransactions'));
        return;
      }
      if (txs.list.length > 0) {
        confirmation(t('buy.pocket.previousTransactions'), result => {
          if (result) {
            sendXpub();
          }
        });
      } else {
        sendXpub();
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
      alertUser(t('unknownError', { errorMessage: 'Invalid amount' }));
      return;
    }

    const txInput: TTxInput = {
      address: message.bitcoinAddress,
      amount: parsedAmount.amount,
      // feeTarget will be automatically set on the highest in the BE.
      feeTarget: 'custom',
      customFee: '',
      sendAll: 'no',
      selectedUTXOs: [],
      paymentRequest: message.slip24,
    };

    let result = await proposeTx(code, txInput);
    if (result.success) {
      let txNote = t('buy.pocket.paymentRequestNote') + ' ' + message.slip24.recipientName;
      const sendResult = await sendTx(code, txNote);
      if (!sendResult.success && !sendResult.aborted) {
        alertUser(t('unknownError', { errorMessage: sendResult.errorMessage }));
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
        if (!signing) {
          handleRequestAddress(message);
        }
        break;
      case V0MessageType.VerifyAddress:
        if (!verifying) {
          handleVerifyAddress(message.bitcoinAddress);
        }
        break;
      case V0MessageType.RequestExtendedPublicKey:
        handleRequestXpub();
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

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={
            <h2>
              {t('generic.buySell')}
            </h2>
          } />
        </div>
        <div ref={ref} className={style.container}>
          { !agreedTerms ? (
            <PocketTerms
              onAgreedTerms={() => setAgreedTerms(true)}
            />
          ) : (
            <div style={{ height }}>
              <UseDisableBackButton />
              {!iframeLoaded && <Spinner guideExists={false} text={t('loading')} /> }
              <iframe
                onLoad={() => {
                  setIframeLoaded(true);
                }}
                ref={iframeRef}
                title="Pocket"
                width="100%"
                height={height}
                frameBorder="0"
                className={style.iframe}
                allow="camera; payment"
                src={iframeURL}>
              </iframe>
            </div>
          )}
          <Dialog
            open={verifying}
            title={t('receive.verifyBitBox02')}
            medium centered>
            <div className="text-center">{t('buy.pocket.verifyBitBox02')}</div>
          </Dialog>
        </div>
      </div>
      <ExchangeGuide exchange="pocket" translationContext="bitcoin" />
    </div>
  );
};
