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
import { MessageVersion, parseMessage, serializeMessage, V0MessageType } from 'request-address';
import { getConfig } from '../../api/backend';
import { Dialog } from '../../components/dialog/dialog';
import { verifyAddress, signAddress, getPocketURL } from '../../api/exchanges';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { PocketTerms } from './pocket-terms';
import { useLoad } from '../../hooks/api';
import { alertUser } from '../../components/alert/Alert';
import Guide from './guide';
import style from './iframe.module.css';

interface TProps {
    code: string;
}

export const Pocket = ({ code }: TProps) => {
  const { t } = useTranslation();

  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const iframeURL = useLoad(getPocketURL(code));
  const config = useLoad(getConfig);

  const ref = createRef<HTMLDivElement>();
  const iframeRef = createRef<HTMLIFrameElement>();
  var signing = false;
  var resizeTimerID: any = undefined;

  const name = 'Bitcoin';

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

  const onMessage = (e: MessageEvent) => {
    if (!iframeURL || !code) {
      return;
    }

    // verify the origin of the received message
    if (e.origin !== new URL(iframeURL).origin) {
      return;
    }

    // handle address request from moonpay
    try {
      const message = parseMessage(e.data);
      if (message.type === V0MessageType.RequestAddress && message.withMessageSignature && !signing) {
        signing = true;
        const addressType = message.withScriptType ? String(message.withScriptType) : '';
        signAddress(
          addressType,
          String(message.withMessageSignature),
          code)
          .then(response => {
            signing = false;
            if (response.success) {
              sendAddress(response.address, response.signature);
            } else {
              if (response.errorCode !== 'userAbort') {
                alertUser(t('genericError'));
                console.log('error: ' + response.errorMessage);
              }
            }
          });
      }
      if (message.type === V0MessageType.VerifyAddress && !verifying) {
        setVerifying(true);
        verifyAddress(message.bitcoinAddress, code)
          .then(response => {
            setVerifying(false);
            if (!response.success) {
              if (response.errorCode === 'addressNotFound') {
                // This should not happen, unless the user receives a tx on the same address between the message signing
                // and the address verification.
                alertUser(t('buy.pocket.usedAddress', { address:  message.bitcoinAddress }));
              } else {
                alertUser(t('genericError'));
                console.log('error: ' + response.errorMessage);
              }
            }
          });
      }
    } catch (e) {
      console.log(e);
      // ignore messages that could not be parsed
      // probably not intended for us, anyway
    }
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

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={<h2>{t('buy.info.title', { name })}</h2>} />
        </div>
        <div ref={ref} className={style.container}>
          { !agreedTerms ? (
            <PocketTerms
              onAgreedTerms={() => setAgreedTerms(true)}
            />
          ) : (
            <div style={{ height }}>
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
            disableEscape={true}
            medium centered>
            <div className="text-center">{t('buy.pocket.verifyBitBox02')}</div>
          </Dialog>
        </div>
      </div>
      <Guide name={name} exchange={'pocket'}/>
    </div>
  );
};
