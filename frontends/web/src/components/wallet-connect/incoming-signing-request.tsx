// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useRef, useState } from 'react';
import { t } from 'i18next';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { SignClientTypes } from '@walletconnect/types';
import {
  TEthSignHandlerParams,
  TLaunchSignDialog,
  TRequestDialogContent,
  createSessionRequestResponder,
  handleWcEthSignRequest,
} from '@/utils/walletconnect-eth-sign-handlers';
import { alertUser } from '@/components/alert/Alert';
import { TStage, WCIncomingSignRequestDialog } from './incoming-signing-request-dialog';

type TSigningRequest = {
  apiCaller: TLaunchSignDialog['apiCaller'];
  onReject: TLaunchSignDialog['onReject'];
};

export const WCSigningRequest = () => {
  const { web3wallet, isWalletInitialized } = useContext(WCWeb3WalletContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<TRequestDialogContent>();
  const [stage, setStage] = useState<TStage>('initial');
  const requestRef = useRef<TSigningRequest>();

  const launchSignDialog = ({ apiCaller, dialogContent, onReject }: TLaunchSignDialog) => {
    requestRef.current = { apiCaller, onReject };
    setDialogContent(dialogContent);
    setStage('initial');
    setDialogOpen(true);
    return true;
  };

  useEffect(() => {
    if (!web3wallet || !isWalletInitialized) {
      return;
    }
    const onSessionRequest = async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      const { topic, params, id } = requestEvent;
      const respond = createSessionRequestResponder(response =>
        web3wallet.respondSessionRequest({ topic, response }));
      const currentSession = web3wallet.getActiveSessions()[topic];
      const handlerArgs: TEthSignHandlerParams = {
        id,
        params,
        currentSession,
        respond,
        launchSignDialog,
      };
      await handleWcEthSignRequest(handlerArgs);
    };
    web3wallet.on('session_request', onSessionRequest);
    return () => {
      web3wallet.off('session_request', onSessionRequest);
    };
  }, [isWalletInitialized, web3wallet]);

  const handleRejectBtn = async () => {
    const request = requestRef.current;
    if (!request) {
      return;
    }

    requestRef.current = undefined;
    setDialogOpen(false);
    setStage('initial');
    await request.onReject();
  };

  const handleAcceptBtn = async () => {
    const request = requestRef.current;
    if (!request) {
      return;
    }

    setStage('confirming');
    const result = await request.apiCaller();
    requestRef.current = undefined;
    if (result.success) {
      setStage('accepted');
      setTimeout(() => {
        setDialogOpen(false);
        setStage('initial');
      }, 5000);
      return;
    }

    setStage('initial');
    setDialogOpen(false);
    if (!result.aborted) {
      alertUser(result.errorMessage || t('pairing.error.text'));
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
