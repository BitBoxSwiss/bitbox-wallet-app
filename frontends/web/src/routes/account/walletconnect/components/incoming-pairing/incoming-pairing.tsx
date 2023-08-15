
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
import { CoreTypes, SignClientTypes } from '@walletconnect/types';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { Button } from '../../../../../components/forms';
import { alertUser } from '../../../../../components/alert/Alert';
import { SUPPORTED_CHAINS, web3wallet } from '../../utils';
import styles from './incoming-pairing.module.css';

type TIncomingPairingProps = {
    currentProposal: SignClientTypes.EventArguments['session_proposal'];
    pairingMetadata: CoreTypes.Metadata;
    receiveAddress: string;
    onReject: () => void;
    onApprove: () => void;
}

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

export const WCIncomingPairing = ({
  currentProposal,
  pairingMetadata,
  receiveAddress,
  onReject,
  onApprove
}: TIncomingPairingProps) => {
  const { t } = useTranslation();
  const handleApprovePairing = async () => {
    try {
      const { id, params } = currentProposal;
      const { requiredNamespaces } = params;
      const eipList = Object.values(requiredNamespaces);
      const accounts = eipList.flatMap(eip => eip.chains?.map(chain => `${chain}:${receiveAddress}`) || []);

      // buildApprovedNamespaces is a
      // utility function by @walletconnect
      const namespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
          eip155: {
            chains: SUPPORTED_CHAINS,
            methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
            events: ['accountsChanged', 'chainChanged'],
            accounts
          },
        },
      });

      await web3wallet?.approveSession({
        id,
        namespaces
      });

      onApprove();
    } catch (e) {
      alertUser(t('walletConnect.invalidPairingChain', { chains: '\n•Ethereum \n•Optimism \n•BSC \n•Polygon \n•Fantom \n•Arbitrum One' }));
      console.error(e);
    }
  };

  const handleRejectPairing = async () => {
    await web3wallet.rejectSession({
      id: currentProposal.id,
      reason: getSdkError('USER_REJECTED_METHODS')
    });
    onReject();
  };

  return (
    <div className={styles.container}>
      <p className={styles.connectionRequest}>{t('walletConnect.pairingRequest.title')}:</p>
      <PairingContainer pairingMetadata={pairingMetadata} />
      <p className={styles.receiveAddress}>{t('accountInfo.address')}: {receiveAddress}</p>
      <div className={styles.buttonsContainer}>
        <Button secondary onClick={handleRejectPairing}>{t('walletConnect.pairingRequest.reject')}</Button>
        <Button primary onClick={handleApprovePairing}>{t('walletConnect.pairingRequest.approve')}</Button>
      </div>
    </div>
  );
};
