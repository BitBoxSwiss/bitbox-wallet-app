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
import type { TAccount } from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { TStage, WCIncomingSignRequestDialog } from './incoming-signing-request-dialog';

type TActiveSigningRequest = {
  accountCode: TLaunchSignDialog['accountCode'];
  apiCaller: TLaunchSignDialog['apiCaller'];
  onReject: TLaunchSignDialog['onReject'];
  processing: boolean;
};

type TProps = {
  accounts: TAccount[];
};

export const WCSigningRequest = ({ accounts }: TProps) => {
  const { web3wallet, isWalletInitialized } = useContext(WCWeb3WalletContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<TRequestDialogContent>();
  const [stage, setStage] = useState<TStage>('initial');
  const activeRequestRef = useRef<TActiveSigningRequest>();
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const launchSignDialog = ({ accountCode, apiCaller, dialogContent, onReject }: TLaunchSignDialog) => {
    if (activeRequestRef.current) {
      return false;
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = undefined;
    }
    activeRequestRef.current = { accountCode, apiCaller, onReject, processing: false };
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
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = undefined;
      }
    };
  }, [isWalletInitialized, web3wallet]);

  const handleRejectBtn = async () => {
    const request = activeRequestRef.current;
    if (!request || request.processing) {
      return;
    }

    activeRequestRef.current = undefined;
    setDialogOpen(false);
    setStage('initial');
    await request.onReject();
  };

  const handleAcceptBtn = async () => {
    const request = activeRequestRef.current;
    if (!request || request.processing) {
      return;
    }

    request.processing = true;
    setStage('confirming');
    const account = accounts.find(({ code }) => code === request.accountCode);
    if (!account) {
      activeRequestRef.current = undefined;
      setDialogOpen(false);
      setStage('initial');
      await request.onReject();
      return;
    }
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (!connectResult.success) {
      activeRequestRef.current = undefined;
      setDialogOpen(false);
      setStage('initial');
      await request.onReject();
      return;
    }
    const result = await request.apiCaller();
    activeRequestRef.current = undefined;
    if (result.success) {
      setStage('accepted');
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = undefined;
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
