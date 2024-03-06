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
import { RequestAddressV0Message, MessageVersion, parseMessage, serializeMessage, V0MessageType } from 'request-address';
import { getConfig } from '../../utils/config';
import { ScriptType, signAddress } from '../../api/account';
import { getInfo } from '../../api/account';
import { Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { BitsuranceTerms } from '../../components/terms/bitsurance-terms';
import { useLoad } from '../../hooks/api';
import { alertUser } from '../../components/alert/Alert';
import { BitsuranceGuide } from './guide';
import { getBitsuranceURL } from '../../api/bitsurance';
import { route } from '../../utils/route';
import style from './widget.module.css';
import { convertScriptType } from '../../utils/request-addess';

type TProps = {
    code: string;
};

export const BitsuranceWidget = ({ code }: TProps) => {
  const { t } = useTranslation();

  const [height, setHeight] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const iframeURL = useLoad(getBitsuranceURL);
  const config = useLoad(getConfig);
  const accountInfo = useLoad(getInfo(code));

  const ref = createRef<HTMLDivElement>();
  const iframeRef = createRef<HTMLIFrameElement>();
  let signing = false;
  let resizeTimerID: any = undefined;

  useEffect(() => {
    if (config) {
      setAgreedTerms(config.frontend.skipBitsuranceDisclaimer);
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

  const sendAddressWithXPub = (address: string, sig: string, xpub: string) => {
    const { current } = iframeRef;

    if (!current) {
      return;
    }

    const message = serializeMessage({
      version: MessageVersion.V0,
      type: V0MessageType.Address,
      bitcoinAddress: address,
      extendedPublicKey: xpub,
      signature: sig,
    });

    current.contentWindow?.postMessage(message, '*');
  };

  const getXPub = (wantedScriptType: ScriptType) => {
    let xpubConfig = accountInfo?.signingConfigurations.find(config =>
      config.bitcoinSimple?.scriptType === wantedScriptType
    );
    return xpubConfig?.bitcoinSimple?.keyInfo.xpub;
  };

  const handleRequestAddress = (message: RequestAddressV0Message) => {
    signing = true;
    const addressType = message.withScriptType ? convertScriptType(message.withScriptType) : '';
    const withMessageSignature = message.withMessageSignature ? message.withMessageSignature : '';
    const withExtendedPublicKey = !!message.withExtendedPublicKey;
    signAddress(
      addressType,
      withMessageSignature,
      code)
      .then(response => {
        signing = false;
        if (response.success) {
          if (withExtendedPublicKey) {
            const xpub = getXPub(addressType as ScriptType);
            if (xpub) {
              sendAddressWithXPub(response.address, response.signature, xpub);
            } else {
              alertUser(t('bitsuranceAccount.errorNoXpub'));
            }
          } else {
            sendAddressWithXPub(response.address, response.signature, '');
          }
        } else {
          if (!['userAbort', 'wrongKeystore'].includes(response.errorCode || '')) {
            alertUser(t('unknownError', { errorMessage: response.errorMessage }));
            console.log('error: ' + response.errorMessage);
          }
        }
      });

  };

  const onMessage = (m: MessageEvent) => {
    if (!iframeURL || !code) {
      return;
    }

    // verify the origin of the received message
    if (m.origin !== new URL(iframeURL).origin) {
      return;
    }

    // handle requests from Bitsurance iframe
    try {
      let message = JSON.parse(m.data);
      if (message?.type === 'showInsuranceDashboard') {
        route('bitsurance/dashboard');
        return;
      }

      message = parseMessage(m.data);
      switch (message.type) {
      case V0MessageType.RequestAddress:
        // we ignore further signing requests
        // while there is an ongoing one
        if (!signing) {
          handleRequestAddress(message);
        }
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
          <Header title={<h2>{t('bitsuranceAccount.title')}</h2>} />
        </div>
        <div ref={ref} className={style.container}>
          { !agreedTerms ? (
            <BitsuranceTerms
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
                title="Bitsurance"
                width="100%"
                height={height}
                frameBorder="0"
                className={style.iframe}
                allow="camera; payment"
                src={iframeURL}>
              </iframe>
            </div>
          )}
        </div>
      </div>
      <BitsuranceGuide/>
    </div>
  );
};
