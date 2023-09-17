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

import { useCallback, useContext, useEffect, useState } from 'react';
import { useLoad } from '../../../hooks/api';
import * as accountApi from '../../../api/account';
import { SignClientTypes } from '@walletconnect/types';
import { WCWeb3WalletContext } from '../../../contexts/WCWeb3WalletContext';
import { Header, Main } from '../../../components/layout';
import { alertUser } from '../../../components/alert/Alert';
import { View, ViewContent } from '../../../components/view/view';
import { WCHeader } from './components/header/header';
import { WCConnectForm } from './components/connect-form/connect-form';
import { TConnectStatus } from './types';
import { WCIncomingPairing } from './components/incoming-pairing/incoming-pairing';
import { WCSuccessPairing } from './components/success-pairing/success-pairing';
import styles from './connect.module.css';

type TProps = {
  code: string;
  accounts: accountApi.IAccount[]
};

export const ConnectScreenWalletConnect = ({
  code,
  accounts
}: TProps) => {
  const [uri, setUri] = useState('');
  const [status, setStatus] = useState<TConnectStatus>('connect');
  const { web3wallet, isWalletInitialized, pair } = useContext(WCWeb3WalletContext);
  const [currentProposal, setCurrentProposal] = useState<SignClientTypes.EventArguments['session_proposal']>();
  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code));
  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments['session_proposal']) => {
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
    try {
      await pair({ uri });
    } catch (err: any) {
      alertUser(err.message);
    } finally {
      setUri('');
    }
  };

  if (!receiveAddresses || !isWalletInitialized) {
    return null;
  }

  const accountName = (accounts && accounts.find(acct => acct.code === code))?.name || '';
  const receiveAddress = receiveAddresses[0].addresses[0].address;

  return (
    <Main>
      <Header />
      <View verticallyCentered fullscreen={false}>
        <ViewContent>
          <WCHeader
            accountName={accountName}
            receiveAddress={receiveAddress}
          />
          <div className={styles.contentContainer}>
            {status === 'connect' &&
            <WCConnectForm
              code={code}
              uri={uri}
              onInputChange={setUri}
              onSubmit={handleConnect}
            />}
            {(status === 'incoming_pairing' && currentProposal) &&
              <WCIncomingPairing
                currentProposal={currentProposal}
                pairingMetadata={currentProposal.params.proposer.metadata}
                receiveAddress={receiveAddress}
                onApprove={handleApprovePairingStates}
                onReject={handleRejectPairingStates}
              />
            }
            {status === 'success' && <WCSuccessPairing accountCode={code} />}
          </div>
        </ViewContent>
      </View>
    </Main>
  );
};
