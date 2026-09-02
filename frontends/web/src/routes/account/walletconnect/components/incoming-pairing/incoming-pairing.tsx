// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CoreTypes, SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { Button } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { Message } from '@/components/message/message';
import { SUPPORTED_CHAINS } from '@/utils/walletconnect';
import { prepareSessionProposal } from '@/utils/walletconnect-session-proposal';
import styles from './incoming-pairing.module.css';

type TIncomingPairingProps = {
  currentProposal: SignClientTypes.EventArguments['session_proposal'];
  pairingMetadata: CoreTypes.Metadata;
  receiveAddress: string;
  onReject: () => void;
  onApprove: () => void;
};

const PairingContainer = ({ pairingMetadata }: {pairingMetadata: TIncomingPairingProps['pairingMetadata']}) => {
  const { name, description, url, icons } = pairingMetadata;
  const hasIcon = icons && icons.length > 0;
  return (
    <div className={styles.pairingDetailContainer}>
      <div>
        <p className={styles.metadata}>{name}</p>
        <p className={styles.metadata}>{description}</p>
        <p className={styles.metadata}>{url}</p>
      </div>
      {hasIcon && <img src={icons[0]} alt="logo" />}
    </div>
  );
};

type TPairingChainsProps = {
  chains: string[];
};

const PairingChains = ({ chains }: TPairingChainsProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.chainsContainer}>
      <p className={styles.chainsLabel}>{t('walletConnect.pairingRequest.chains')}</p>
      <ul className={styles.chainsList}>
        {chains.map(chain => {
          const chainDetail = SUPPORTED_CHAINS[chain];
          return chainDetail && (
            <li className={styles.chain} key={chain}>
              <img alt="" src={chainDetail.icon} />
              <span>{t(chainDetail.nameKey)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const WCIncomingPairing = ({
  currentProposal,
  pairingMetadata,
  receiveAddress,
  onReject,
  onApprove
}: TIncomingPairingProps) => {
  const [pairingLoading, setPairingLoading] = useState(false);
  const { web3wallet } = useContext(WCWeb3WalletContext);
  const { t } = useTranslation();
  const sessionProposal = useMemo(
    () => prepareSessionProposal(currentProposal.params, receiveAddress),
    [currentProposal.params, receiveAddress],
  );

  useEffect(() => {
    if (sessionProposal.status === 'unsupported' && sessionProposal.error) {
      console.error('Wallet connect session proposal is not supported', sessionProposal.error);
    }
  }, [sessionProposal]);

  const handleRejectPairing = async () => {
    setPairingLoading(true);
    try {
      await web3wallet?.rejectSession({
        id: currentProposal.id,
        reason: getSdkError('USER_REJECTED')
      });
    } catch (error) {
      console.error('Wallet connect reject pairing error', error);
      alertUser(t('walletConnect.pairingRequest.rejectionFailed'));
    } finally {
      onReject();
      setPairingLoading(false);
    }
  };

  const handleApprovePairing = async () => {
    if (sessionProposal.status !== 'ready') {
      return;
    }
    setPairingLoading(true);
    try {
      await web3wallet?.approveSession({
        id: currentProposal.id,
        namespaces: sessionProposal.namespaces
      });

      onApprove();
    } catch (error) {
      console.error('Wallet connect approve pairing error', error);
      alertUser(error instanceof Error ? error.message : t('pairing.error.text'));
      await handleRejectPairing();
    } finally {
      setPairingLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <p className={styles.connectionRequest}>{t('walletConnect.pairingRequest.title')}:</p>
      <PairingContainer pairingMetadata={pairingMetadata} />
      <p className={styles.receiveAddress}>{t('accountInfo.address')}: {receiveAddress}</p>
      {sessionProposal.status === 'ready' && (
        <>
          <PairingChains chains={sessionProposal.chains} />
          {sessionProposal.readOnly && (
            <Message className={styles.message} type="info">
              {t('walletConnect.pairingRequest.readOnly')}
            </Message>
          )}
        </>
      )}
      {sessionProposal.status === 'unsupported' && (
        <Message className={styles.message} type="error">
          {t('walletConnect.pairingRequest.unsupported')}
        </Message>
      )}
      <div className={[
        styles.buttonsContainer,
        sessionProposal.status === 'unsupported' ? styles.closeButtonContainer : '',
      ].join(' ')}>
        {sessionProposal.status === 'ready' ? (
          <>
            <Button disabled={pairingLoading} secondary onClick={handleRejectPairing}>{t('walletConnect.pairingRequest.reject')}</Button>
            <Button disabled={pairingLoading} primary onClick={handleApprovePairing}>{t('walletConnect.pairingRequest.approve')}</Button>
          </>
        ) : (
          <Button disabled={pairingLoading} primary onClick={handleRejectPairing}>{t('generic.close')}</Button>
        )}
      </div>
    </div>
  );
};
