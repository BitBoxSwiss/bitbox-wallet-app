// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SignClientTypes } from '@walletconnect/types';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { WCGuide } from './guide';
import { TConnectStatus } from './types';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { alertUser } from '@/components/alert/Alert';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { WCHeader } from './components/header/header';
import { WCConnectForm } from './components/connect-form/connect-form';
import { WCIncomingPairing } from './components/incoming-pairing/incoming-pairing';
import { WCSuccessPairing } from './components/success-pairing/success-pairing';

type TProps = {
  code: accountApi.AccountCode;
  accounts: accountApi.TAccount[];
};

export const ConnectScreenWalletConnect = ({
  code,
  accounts
}: TProps) => {
  const [uri, setUri] = useState('');
  const [status, setStatus] = useState<TConnectStatus>('connect');
  const [loading, setLoading] = useState(false);
  const { web3wallet, isWalletInitialized, pair } = useContext(WCWeb3WalletContext);
  const [currentProposal, setCurrentProposal] = useState<SignClientTypes.EventArguments['session_proposal']>();
  const { t } = useTranslation();
  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code));
  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments['session_proposal']) => {
      setUri('');
      setLoading(false);
      setStatus('incoming_pairing');
      setCurrentProposal(proposal);
    },
    []
  );

  useEffect(() => {
    if (isWalletInitialized) {
      web3wallet?.on('session_proposal', onSessionProposal);
      return () => {
        web3wallet?.off('session_proposal', onSessionProposal);
      };
    }
  }, [onSessionProposal, isWalletInitialized, web3wallet]);

  const handleApprovePairingStates = () => {
    setStatus('success');
    setUri('');
    setCurrentProposal(undefined);
  };

  const handleRejectPairingStates = () => {
    setStatus('connect');
    setUri('');
    setCurrentProposal(undefined);
  };

  const handleConnect = async (uri: string) => {
    if (!uri) {
      return;
    }
    setLoading(true);
    try {
      await pair({ uri });
    } catch (err: any) {
      if (err.message.includes('Missing or invalid. pair()')) {
        alertUser(`${t('walletConnect.connect.invalidPairingUri')}: ${uri}`);
      } else {
        alertUser(err.message);
      }
      setUri('');
      setLoading(false);
    }
  };

  if (!receiveAddresses || !isWalletInitialized) {
    return null;
  }

  const accountName = (accounts && accounts.find(acct => acct.code === code))?.name || '';
  const receiveAddress = receiveAddresses[0].addresses[0].address;

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header />
          <View
            fitContent
            verticallyCentered
            width="620px">
            <ViewHeader>
              <WCHeader
                accountName={accountName}
                receiveAddress={receiveAddress}
              />
            </ViewHeader>
            <ViewContent>
              {status === 'connect' && (
                <WCConnectForm
                  connectLoading={loading}
                  uri={uri}
                  onInputChange={setUri}
                  onSubmit={async (uri) => {
                    await handleConnect(uri);
                  }}
                />
              )}
              {(status === 'incoming_pairing' && currentProposal) && (
                <WCIncomingPairing
                  currentProposal={currentProposal}
                  pairingMetadata={currentProposal.params.proposer.metadata}
                  receiveAddress={receiveAddress}
                  onApprove={handleApprovePairingStates}
                  onReject={handleRejectPairingStates}
                />
              )}
              {status === 'success' && <WCSuccessPairing accountCode={code} />}
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <WCGuide />
    </GuideWrapper>
  );
};
