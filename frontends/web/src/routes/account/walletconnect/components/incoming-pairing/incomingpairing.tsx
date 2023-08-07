
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
import { SUPPORTED_CHAINS, web3wallet } from '../../utils';
import styles from './incomingpairing.module.css';

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
  const handleApprovePairing = async () => {
    const { id, params } = currentProposal;
    const { requiredNamespaces } = params;
    const accounts: string[] = [];
    Object.keys(requiredNamespaces).forEach(key => {
      requiredNamespaces[key].chains?.map(chain => accounts.push(`${chain}:${receiveAddress}`));
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
          accounts
        },
      },
    });

    await web3wallet?.approveSession({
      id,
      namespaces: approvedNamespaces
    });

    onApprove();
  };

  const handleRejectPairing = async () => {
    await web3wallet.rejectSession({
      id: currentProposal.id,
      reason: getSdkError('USER_REJECTED_METHODS')
    });
    onReject();
  };

  const { t } = useTranslation();
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
