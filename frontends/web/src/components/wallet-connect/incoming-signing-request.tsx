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

import { MutableRefObject, useContext, useEffect, useRef, useState } from 'react';
import { t } from 'i18next';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { SignClientTypes } from '@walletconnect/types';
import { TEthSignHandlerParams, TLaunchSignDialog, TRequestDialogContent, handleWcEthSignRequest } from '@/utils/walletconnect-eth-sign-handlers';
import { alertUser } from '@/components/alert/Alert';
import { rejectMessage } from '@/utils/walletconnect';
import { TStage, WCIncomingSignRequestDialog } from './incoming-signing-request-dialog';

type TSigningRequestData = {
  topic: string;
  id: number;
}

export const WCSigningRequest = () => {
  const { web3wallet, isWalletInitialized } = useContext(WCWeb3WalletContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<TRequestDialogContent>();
  const [stage, setStage] = useState<TStage>('initial');
  const signMessageApiCallerRef: MutableRefObject<(() => Promise<any>) | undefined> = useRef();
  const requestDataRef = useRef<TSigningRequestData>();

  const launchSignDialog = ({ topic, id, apiCaller, dialogContent }: TLaunchSignDialog) => {
    const { signingData, currentSession, accountAddress, accountName, chain, method } = dialogContent;

    // storing data to be used whenever
    // user accepts or rejects later
    // (see handleAcceptBtn & handleRejectBtn)
    requestDataRef.current = { topic, id };

    // storing the appropriate "signing api call" to be called later on (see handleAcceptBtn)
    signMessageApiCallerRef.current = apiCaller;

    // preparing to be displayed in the UI (dialog)
    setDialogContent({
      accountAddress,
      accountName,
      signingData,
      chain,
      currentSession,
      method
    });

    // opening the dialog
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!web3wallet && !isWalletInitialized) {
      return;
    }
    const onSessionRequest = async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      const { topic, params, id } = requestEvent;
      const activeSessions = Object.values(web3wallet?.getActiveSessions() || {});
      const currentSession = activeSessions.find(session => session.topic === topic);
      if (currentSession) {
        const handlerArgs: TEthSignHandlerParams = {
          topic,
          id,
          params,
          currentSession,
          launchSignDialog,
        };
        await handleWcEthSignRequest(params.request.method, handlerArgs);
      }
    };
    web3wallet?.on('session_request', onSessionRequest);
    return () => {
      web3wallet?.off('session_request', onSessionRequest);
    };
  }, [isWalletInitialized, web3wallet]);

  const handleRejectBtn = async () => {
    setDialogOpen(false);
    const requestData = requestDataRef.current;
    if (requestData) {
      const { topic, id } = requestData;
      await web3wallet?.respondSessionRequest({ topic, response: rejectMessage(id) });
    }
  };

  const handleAcceptBtn = async () => {
    const apiCaller = signMessageApiCallerRef.current;
    const requestData = requestDataRef.current;
    if (apiCaller && requestData) {
      setStage('confirming');
      const { topic, id, } = requestData;
      const { response, success, error } = await apiCaller();
      if (success) {
        //user proceeds to sign in BB02 device
        await web3wallet?.respondSessionRequest({ topic, response });
        setStage('accepted');
        setTimeout(() => {
          setDialogOpen(false);
          setStage('initial');
        }, 5000);
      } else if (error.aborted) {
        //rejected from BB02 device
        setStage('initial');
        setDialogOpen(false);
        await web3wallet?.respondSessionRequest({ topic, response: rejectMessage(id) });
      } else {
        setStage('initial');
        const { errorMessage } = error;
        alertUser(errorMessage ? errorMessage : t('pairing.error.text'));
      }
    }
  };

  if (!dialogContent || !dialogOpen) {
    return null;
  }

  return (
    <WCIncomingSignRequestDialog
      content={dialogContent}
      open={dialogOpen}
      stage={stage}
      onAccept={handleAcceptBtn}
      onReject={handleRejectBtn}
    />
  );
};
