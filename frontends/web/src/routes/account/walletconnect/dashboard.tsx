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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { getAddressFromEIPString, truncateAddress } from '@/utils/walletconnect';
import { AccountCode, IAccount, getReceiveAddressList } from '@/api/account';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { WCSessionCard } from './components/session-card/session-card';
import { Button } from '@/components/forms';
import { Status } from '@/components/status/status';
import { WCGuide } from './guide';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import styles from './dashboard.module.css';

type TProps = {
  accounts: IAccount[];
  code: AccountCode;
}

export const DashboardWalletConnect = ({ code, accounts }: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { web3wallet, isWalletInitialized, initializeWeb3Wallet } = useContext(WCWeb3WalletContext);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>();
  const receiveAddresses = useLoad(getReceiveAddressList(code));

  const updateSessions = useCallback(() => {
    const activeSessions = Object.values(web3wallet?.getActiveSessions() || []);
    setSessions(activeSessions);
  }, [web3wallet]);

  useEffect(() => {
    if (!web3wallet) {
      initializeWeb3Wallet();
      return;
    }
    updateSessions();
  }, [initializeWeb3Wallet, updateSessions, web3wallet]);

  useEffect(() => {
    if (isWalletInitialized) {
      web3wallet?.on('session_delete', updateSessions);
      return () => {
        web3wallet?.off('session_delete', updateSessions);
      };
    }
  }, [isWalletInitialized, updateSessions, web3wallet]);

  const handleDisconnectSession = async (topic: string) => {
    await web3wallet?.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
    updateSessions();
  };

  if (!receiveAddresses || !isWalletInitialized) {
    return null;
  }

  const receiveAddress = truncateAddress(receiveAddresses[0].addresses[0].address);
  const accountName = (accounts && accounts.find(acct => acct.code === code))?.name || '';
  const hasSession = sessions && sessions.length > 0;

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <Status
              type="info"
              dismissible="walletConnectDisclaimerDismissed"
            >
              {t('walletConnect.dashboard.disclaimer')}
            </Status>
          </ContentWrapper>
          <Header
            title={<h2>{t('walletConnect.walletConnect')}</h2>}
          />
          <View>
            <ViewContent>
              <div className={styles.headerContainer}>
                <div>
                  <p>{accountName}</p>
                  <p className={styles.receiveAddress}>{receiveAddress}</p>
                </div>
                <Button className={styles.buttonNewConnection} onClick={() => navigate(`/account/${code}/wallet-connect/connect`)} primary>
                  {t('walletConnect.dashboard.newConnection')}
                </Button>
              </div>
              <hr className={styles.separator} />
              {hasSession &&
                (
                  <div className={styles.sessionCardsContainer}>
                    <p className={styles.allSessionsHeading}>{t('walletConnect.dashboard.allSessions')}</p>
                    {sessions.map(session => {
                      const eip155 = session.namespaces['eip155'];
                      const receiveAddress = eip155?.accounts[0] && getAddressFromEIPString(eip155.accounts[0]) || '';
                      return (
                        <WCSessionCard
                          key={session.topic}
                          receiveAddress={receiveAddress}
                          metadata={session.peer.metadata}
                          onDisconnect={() => handleDisconnectSession(session.topic)}
                        />
                      );
                    })}
                  </div>
                )
              }
              {!hasSession &&
                <p className={styles.noConnectedSessions}>{t('walletConnect.dashboard.noConnectedSessions')}</p>
              }
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <WCGuide />
    </GuideWrapper>
  );
};
