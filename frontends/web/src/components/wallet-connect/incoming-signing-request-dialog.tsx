// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useDarkmode } from '@/hooks/darkmode';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { SUPPORTED_CHAINS, truncateAddress } from '@/utils/walletconnect';
import { TRequestDialogContent } from '@/utils/walletconnect-eth-sign-handlers';
import { AnimatedChecked, PointToBitBox02, WalletConnectDark, WalletConnectLight } from '@/components/icon';
import styles from './incoming-signing-request.module.css';

export type TStage = 'initial' | 'confirming' | 'accepted';

type TRequestDialogProps = {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
  content: TRequestDialogContent;
  stage: TStage;
};

const ConfirmOnBB02 = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.animationAndTextContainer}>
      <p>{t('confirmOnDevice')}</p>
      <PointToBitBox02 />
    </div>
  );
};

const RequestSuccessfullySigned = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.animationAndTextContainer}>
      <AnimatedChecked className={styles.successIcon} />
      <p>{t('walletConnect.signingRequest.successfullySigned')}</p>
    </div>
  );
};


export const WCIncomingSignRequestDialog = ({
  open,
  onAccept,
  onReject,
  content,
  stage,
}: TRequestDialogProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const { accountAddress, accountName, signingData, chain, method, currentSession } = content;

  const formattedChain = chain in SUPPORTED_CHAINS ? SUPPORTED_CHAINS[chain]?.name : chain;
  const chainIcon = chain in SUPPORTED_CHAINS ? SUPPORTED_CHAINS[chain]?.icon : null;

  const metadata = currentSession.peer.metadata;

  // for text area height (rows) calculation
  const maxTextAreaRows = 20;
  // 3 works as an additional spacing, especially useful for when height is of very small value (e.g 1)
  const signingDataHeight = signingData.toString().split('\n').length + 3;
  const textAreaRows = signingDataHeight > maxTextAreaRows ? maxTextAreaRows : signingDataHeight;

  return (
    <Dialog open={open} large onClose={onReject}>
      <div className={styles.titleContainer}>
        {isDarkMode ? <WalletConnectLight height={32} width={32} /> : <WalletConnectDark height={40} width={40} />}
        <h3>{t('walletConnect.signingRequest.walletConnectRequest')}</h3>
      </div>
      <div className={styles.outerContainer}>

        {
          stage !== 'accepted' && (
            <>
              <ul className={styles.listContainer}>
                <li className={styles.item}>
                  <p className={styles.label}>{t('account.account')}</p>
                  <span className={styles.accountNameAndAddress}>
                    <p className={styles.accountName}><b>{accountName}</b></p>
                    <p className={styles.address}>{truncateAddress(accountAddress)}</p>
                  </span>
                </li>

                <li className={styles.item}>
                  <p className={styles.label}>{t('walletConnect.signingRequest.chain')}</p>
                  <div className={styles.chainContainer}>
                    <p className={styles.itemText}>{formattedChain}</p>
                    {chainIcon}
                  </div>
                </li>

                <li className={styles.item}>
                  <p className={styles.label}>{t('walletConnect.signingRequest.dapp')}</p>
                  <p className={styles.itemText}>{metadata.name}</p>
                </li>

                <li className={styles.item}>
                  <p className={styles.label}>{t('transaction.details.type')}</p>
                  <p className={styles.itemText}>{method}</p>
                </li>

                {signingData &&
            (
              <li className={styles.item}>
                <p className={styles.label}>{t('walletConnect.signingRequest.data')}</p>
                <textarea rows={textAreaRows} className={styles.textarea} readOnly value={signingData.toString()} />
              </li>
            )
                }
              </ul>

              {stage === 'confirming' && (
                <ConfirmOnBB02 />
              )}

              {stage === 'initial' && (
                <DialogButtons>
                  <Button onClick={onAccept} primary type="submit">{t('button.continue')}</Button>
                  <Button onClick={onReject} secondary type="submit">{t('dialog.cancel')}</Button>
                </DialogButtons>
              )}
            </>
          )
        }

        {
          stage === 'accepted' && <RequestSuccessfullySigned />
        }

      </div>

    </Dialog>
  );
};