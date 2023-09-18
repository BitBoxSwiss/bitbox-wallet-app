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
import { Header } from '../../../components/layout';
import { useEsc } from '../../../hooks/keyboard';
import * as accountApi from '../../../api/account';
import { route } from '../../../utils/route';
import { useCallback, useEffect, useState } from 'react';
import { useLoad } from '../../../hooks/api';
import { Button, Input } from '../../../components/forms';
import { PairingTypes, SessionTypes, SignClientTypes } from '@walletconnect/types';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import useInitialization, { SUPPORTED_CHAINS, EIP155_SIGNING_METHODS, decodeEthMessage, pair, web3wallet } from './utils';
import React from 'react';
import { alertUser } from '../../../components/alert/Alert';
import { ethSignMessage, ethSignTypedMessage, ethSignWalletConnectTx } from '../../../api/account';

type TProps = {
  code: string;
};

export const WalletConnect = ({
  code,
}: TProps) => {
  const { t } = useTranslation();
  const [currentAddresses, setCurrentAddresses] = useState<accountApi.IReceiveAddress[]>();
  const [uri, setUri] = useState('');
  const [approveModal, setApproveModal] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const [modalPromiseResolve, setModalPromiseResolve] = useState<((value: boolean | PromiseLike<boolean>) => void) | null>(null);
  const [signModalTitle, setSignModalTitle] = useState('');
  const [signingSession, setSigningSession] = useState<SessionTypes.Struct | null>(null);
  const [signingData, setSigningData] = useState('');
  const [currentProposal, setCurrentProposal] = useState<SignClientTypes.EventArguments['session_proposal']>();
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [pairings, setPairings] = useState<PairingTypes.Struct[]>([]);


  const isInitialized = useInitialization();

  function updatePairings() {
    setPairings(web3wallet?.core.pairing.getPairings());
  }

  function updateSessions() {
    setSessions(Object.values(web3wallet?.getActiveSessions()));
  }

  useEffect(() => {
    if (isInitialized) {
      updatePairings();
      updateSessions();
    }
  }, [isInitialized]);

  const currentAddressIndex = 0;

  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code));

  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments['session_proposal']) => {
      setApproveModal(true);
      setCurrentProposal(proposal);
    },
    []
  );

  const onAuthRequest = useCallback(
    () => {
      // TODO: Handle Auth signature requests
      console.log('auth_request');
    },
    []
  );

  const handleSignAccept = () => {
    setSignModal(false);
    modalPromiseResolve?.(true);
  };

  const handleSignReject = () => {
    setSignModal(false);
    modalPromiseResolve?.(false);
  };

  const openSignModal = useCallback(() => {
    setSignModal(true);
    return new Promise<boolean>((resolve) => {
      setModalPromiseResolve(() => resolve);
    });
  }, []);

  const handleSessionRequest = useCallback(async (
    apiCaller: () => Promise<any>,
    currentSession: SessionTypes.Struct,
    topic: string,
    id: number,
    title: string,
    data: any) => {

    setSigningSession(currentSession);
    setSignModalTitle(title);
    setSigningData(data);

    const rejected = {
      id,
      jsonrpc: '2.0',
      error: {
        code: 5000,
        message: 'User rejected.'
      }
    };

    const accepted = await openSignModal();
    if (accepted) {
      const { response, success, error } = await apiCaller();
      if (success) {
        await web3wallet.respondSessionRequest({ topic, response });
      } else if (error.aborted) {
        await web3wallet.respondSessionRequest({ topic, response: rejected });
      } else {
        const { errorMessage } = error;
        alertUser(errorMessage ? errorMessage : 'Something went wrong');
      }
    } else {
      await web3wallet.respondSessionRequest({ topic, response: rejected });
    }
    setSigningSession(null);
    setSigningData('');
    setSignModalTitle('');
  }, [openSignModal]);

  const onSessionRequest = useCallback(
    async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      const { topic, params, id } = requestEvent;
      const { request } = params;
      let message: string;
      let decodedMessage;
      const activeSessions = Object.values(web3wallet?.getActiveSessions());
      const currentSession = activeSessions.find((session) => session.topic === topic);

      switch (request.method) {
      case EIP155_SIGNING_METHODS.ETH_SIGN:
        /**
        * Wallet Connect's ETH_SIGN gives the params as [address, message]
        * while PERSONAL_SIGN gives them as [message, address]
        */
        message = request.params[1];
        decodedMessage = decodeEthMessage(message);
        if (currentSession) {
          handleSessionRequest(async () => {
            const result = await ethSignMessage(code, message);
            if (result.success) {
              const response = { id, jsonrpc: '2.0', result: result.signature };
              return { response, success: true };
            }

            return { success: false, error: result };
          },
          currentSession, topic, id, 'Sign Message', decodedMessage ? decodedMessage : message);
        }
        return;
      case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
        message = request.params[0];
        decodedMessage = decodeEthMessage(message);
        if (currentSession) {
          handleSessionRequest(async () => {
            const result = await ethSignMessage(code, message);
            if (result.success) {
              const response = { id, jsonrpc: '2.0', result: result.signature };
              return { response, success: true };
            }

            return { success: false, error: result };
          },
          currentSession, topic, id, 'Sign Message', decodedMessage ? decodedMessage : message);
        }
        return;
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3:
      case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4:
        const typedData = JSON.parse(request.params[1]);
        if (currentSession) {
          handleSessionRequest(async () => {
            // If the typed data to be signed includes its own chainId, we use that, otherwise use the id in the params
            const chainId = typedData.domain.chainId ?
              +typedData.domain.chainId :
              +params.chainId.replace(/^eip155:/, '');
            const result = await ethSignTypedMessage(code, chainId, request.params[1]);
            if (result.success) {
              const response = { id, jsonrpc: '2.0', result: result.signature };
              return { response, success: true };
            }

            return { success: false, error: result };
          },
          currentSession, topic, id, 'Sign Typed Data', JSON.stringify(typedData));
        }
        return;
      //TODO: for the following two cases, let user set own gas price and nonce in BBApp
      case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
        if (currentSession) {
          handleSessionRequest(async () => {
            const result = await ethSignWalletConnectTx(code, true, +params.chainId.replace(/^eip155:/, ''), request.params[0]);
            if (result.success) {
              const response = { id, jsonrpc: '2.0', result: result.txHash };
              return { response, success: true };
            }
            return { success: false, error: result };
          },
          currentSession, topic, id, 'Sign and Send Transaction', JSON.stringify(request.params[0]));
        }
        return;
      case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION:
        if (currentSession) {
          handleSessionRequest(async () => {
            const result = await ethSignWalletConnectTx(code, false, +params.chainId.replace(/^eip155:/, ''), request.params[0]);
            if (result.success) {
              const response = { id, jsonrpc: '2.0', result: result.rawTx };
              return { response, success: true };
            }
            return { success: false, error: result };
          },
          currentSession, topic, id, 'Sign Transaction', JSON.stringify(request.params[0]));
        }
        return;
      default:
        console.log('not supported');
      }
    },
    [code, handleSessionRequest]
  );

  const onSessionDelete = useCallback(
    (deleteRequest: SignClientTypes.EventArguments['session_delete']) => {
      const { topic } = deleteRequest;
      setSessions(sessions => sessions.filter(session => session.topic !== topic));
    },
    []
  );

  async function disconnect(topic: string) {
    await web3wallet.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
    updateSessions();
  }

  const onApprove = useCallback(async () => {
    if (currentProposal && currentAddresses) {
      const { id, params } = currentProposal;
      const { requiredNamespaces } = params;
      let accounts: string[] = [];
      Object.keys(requiredNamespaces).forEach(key => {
        requiredNamespaces[key].chains?.map(chain => accounts.push(`${chain}:${currentAddresses[0].address}`));
      });

      // ------- namespaces builder util ------------ //
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          eip155: {
            chains: SUPPORTED_CHAINS,
            methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
            // TODO: handle emitting accountsChanged events
            // TODO: handle emitting chainChanged event, we need to have a chain selector in the app to support other networks in dapps properly
            events: ['accountsChanged', 'chainChanged'],
            accounts: accounts
          },
        },
      });

      await web3wallet?.approveSession({
        id,
        namespaces: approvedNamespaces
      });

      setApproveModal(false);
      setUri('');
      setCurrentProposal(undefined);
      updateSessions();
    }
  }, [currentAddresses, currentProposal]);

  async function onReject() {
    if (currentProposal) {
      await web3wallet.rejectSession({
        id: currentProposal.id,
        reason: getSdkError('USER_REJECTED_METHODS')
      });
    }
    setApproveModal(false);
    setUri('');
    setCurrentProposal(undefined);
  }

  async function onConnect(uri: string) {
    try {
      await pair({ uri });
    } catch (err: unknown) {
      alert(err);
    } finally {
      setUri('');
    }
  }

  useEsc(() => route(`/account/${code}`));

  useEffect(() => {
    if (receiveAddresses) {
      setCurrentAddresses(receiveAddresses[currentAddressIndex].addresses);
    }
  }, [receiveAddresses, currentAddresses]);


  useEffect(() => {
    web3wallet?.on('session_proposal', onSessionProposal);
    web3wallet?.on('session_request', onSessionRequest);
    web3wallet?.on('session_delete', onSessionDelete);
    web3wallet?.on('auth_request', onAuthRequest);
    return () => {
      web3wallet?.off('session_proposal', onSessionProposal);
      web3wallet?.off('session_request', onSessionRequest);
      web3wallet?.off('session_delete', onSessionDelete);
      web3wallet?.off('auth_request', onAuthRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onApprove,
    onAuthRequest,
    onSessionRequest,
    onSessionDelete,
    web3wallet,
    onSessionProposal,
    openSignModal,
  ]);

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('accountInfo.title')}</h2>} />
          <div className="content padded">
            <div className="box larger">
              <Button
                primary
                onClick={() => web3wallet?.core.pairing.getPairings().forEach((pairing) => {
                  web3wallet.core.pairing.disconnect({ topic: pairing.topic });
                })}>
                  REMOVE PAIRINGS
              </Button>
              <div>
                {/* TODO: Add QR Code scanning and deep linking */}
                <Input
                  value={uri}
                  onInput={e => setUri(e.target.value)}>
                </Input>
                <Button
                  primary
                  onClick={() => onConnect(uri)}>
                    Connect
                </Button>
              </div>

              { sessions.length &&
                <div className="box larger">
                  <div>Sessions</div>
                  {
                    sessions.map((session) => {
                      return (
                        <React.Fragment key={session.topic}>
                          <span>
                            <img src={session.peer.metadata.icons[0]} width="50" height="50"></img>
                            <span>{session.peer.metadata.name}</span>
                          </span>
                          <div>{session.peer.metadata.description}</div>
                          <a>{session.peer.metadata.url}</a>
                          {/* TODO: Convert chain number to human readable format */}
                          <div>{session.namespaces.eip155.chains}</div>
                          {/* TODO: Convert expiry timestamp to human readable datetime */}
                          <div>{session.expiry}</div>
                          <Button primary onClick={() => disconnect(session.topic)}>Disconnect</Button>
                        </React.Fragment>
                      );
                    })
                  }
                </div>
              }

              { pairings.length &&
                <div className="box larger">
                  <div>Pairings</div>
                  {
                    pairings.map((pairing) => {
                      return (
                        <div>
                          <React.Fragment key={pairing.topic}>
                            <span>
                              <img src={pairing.peerMetadata?.icons[0]} width="50" height="50"></img>
                              <span>{pairing.peerMetadata?.name}</span>
                            </span>
                            <div>{pairing.peerMetadata?.description}</div>
                            <a>{pairing.peerMetadata?.url}</a>
                            <div>{pairing.expiry}</div>
                            {/* <Button primary onClick={() => deletePairing(pairing.topic)}>Disconnect</Button> */}
                          </React.Fragment>
                        </div>
                      );
                    })
                  }
                </div>
              }

              <Dialog open={approveModal} medium title={'Approve Wallet Connect'} >
                {currentProposal && currentAddresses &&
                <div>
                  <div>New Connection Request</div>
                  <span>
                    <img src={currentProposal.params.proposer.metadata.icons[0]} width="50" height="50"></img>
                    <span>{currentProposal.params.proposer.metadata.name}</span>
                  </span>
                  <div>{currentProposal.params.proposer.metadata.description}</div>
                  <div>{currentProposal.params.proposer.metadata.url}</div>
                  <div>Account: {currentAddresses[0].address}</div>
                  <DialogButtons>
                    <Button onClick={onApprove} primary type="submit">Approve Connection</Button>
                    <Button onClick={onReject} primary type="submit">Reject Connection</Button>
                  </DialogButtons>
                </div>
                }
              </Dialog>

              <Dialog open={signModal} medium title={'Signature request'} >
                {signingSession && currentAddresses &&
                <div>
                  <div>{signModalTitle}</div>
                  <span>
                    <img src={signingSession.peer.metadata.icons[0]} width="50" height="50"></img>
                    <span>{signingSession.peer.metadata.name}</span>
                  </span>
                  <div>{signingSession.peer.metadata.description}</div>
                  <div>Account: {currentAddresses[0].address}</div>
                  {/* TODO: Display stringified JSON nicely */}
                  <div>Data: {signingData && signingData} </div>
                  {/* TODO: Add input to set custom gas fees */}
                  <DialogButtons>
                    <Button onClick={handleSignAccept} primary type="submit">Sign</Button>
                    <Button onClick={handleSignReject} primary type="submit">Reject</Button>
                  </DialogButtons>
                </div>
                }
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
