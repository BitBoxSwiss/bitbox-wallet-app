// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TTransaction, CoinCode } from '@/api/account';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Dialog } from '@/components/dialog/dialog';
import { Note } from './note';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { getTxSignForTxDetail } from '@/utils/transaction';
import { FastForwardWhite, ExternalLink } from '@/components/icon';
import { TxDetailHeader } from '@/components/transactions/components/tx-detail-dialog/tx-detail-header';
import { AdvancedTxDetail } from '@/components/transactions/components/tx-detail-dialog/advanced-tx-detail';
import { TxDetailRow } from '@/components/transactions/components/tx-detail-dialog/tx-detail-row';
import { AddressOrTxId } from '@/components/transactions/components/tx-detail-dialog/address-or-tx-id';
import styles from './tx-detail-dialog.module.css';

type TProps = {
  open: boolean;
  onClose: () => void;
  accountCode: string;
  coinCode: CoinCode;
  explorerURL: string;
} & TTransaction;

// Bitcoin coin codes that support RBF (Replace-By-Fee)
const BITCOIN_COIN_CODES: CoinCode[] = ['btc', 'tbtc', 'rbtc'];

export const TxDetailsDialog = ({
  open,
  onClose,
  accountCode,
  coinCode,
  explorerURL,
  addresses,
  amount,
  amountAtTime,
  fee,
  internalID,
  note,
  numConfirmations,
  numConfirmationsComplete,
  time,
  txID,
  type,
  ...transactionInfo
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const displayedSign = getTxSignForTxDetail(type);
  const amountSign = amount.amount === '0' ? '' : displayedSign;
  const amountAtTimeSign = amountAtTime?.amount === '0' ? '' : displayedSign;

  const isRBFEligible =
    BITCOIN_COIN_CODES.includes(coinCode) &&
    numConfirmations === 0 &&
    (type === 'send' || type === 'send_to_self');

  const handleSpeedUp = () => {
    navigate(`/account/${accountCode}/send?rbf=${encodeURIComponent(internalID)}`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      title={t('transaction.details.title')}
      onClose={onClose}
      slim
      medium>
      <div className={styles.container} data-testid="tx-details-container">
        <TxDetailHeader
          status={transactionInfo.status}
          numConfirmations={numConfirmations}
          numConfirmationsComplete={numConfirmationsComplete}
          type={type}
          amount={amount}
          transactionInfo={{
            addresses,
            amount,
            amountAtTime,
            fee,
            internalID,
            note,
            numConfirmations,
            numConfirmationsComplete,
            time,
            txID,
            type,
            ...transactionInfo,
          }}
          time={time}
          amountSign={amountSign}
          amountAtTimeSign={amountAtTimeSign}
        />

        <hr className={styles.separator} />

        <Note
          accountCode={accountCode}
          internalID={internalID}
          note={note}
        />

        <TxDetailRow>
          <p className={styles.label}>{t('send.confirm.to')}</p>
          <AddressOrTxId values={addresses} />
        </TxDetailRow>

        <TxDetailRow>
          <p className={styles.label}>{t('transaction.fee')}</p>
          <span><AmountWithUnit amount={fee} unitClassName={styles.rowUnit} /></span>
        </TxDetailRow>

        {amountAtTime?.estimated === false && (
          <TxDetailRow>
            <div>
              <p className={styles.label}>{t('transaction.details.historicalValue')}</p>
            </div>
            <span>
              <AmountWithUnit
                amount={amountAtTime}
                convertToFiat
                unitClassName={styles.rowUnit}
              />
            </span>
          </TxDetailRow>
        )}

        <TxDetailRow>
          <div>
            <p className={styles.label}>{t('transaction.details.currentValue')}</p>
          </div>
          <span>
            <AmountWithUnit
              amount={amount}
              convertToFiat
              unitClassName={styles.rowUnit}
            />
          </span>
        </TxDetailRow>

        <TxDetailRow>
          <p className={`
            ${styles.label || ''}
            ${styles.nowrap || ''}
          `}>{t('transaction.explorer')}</p>
          <AddressOrTxId values={[internalID]} />
        </TxDetailRow>

        <AdvancedTxDetail transactionInfo={{
          addresses,
          amount,
          amountAtTime,
          fee,
          internalID,
          note,
          numConfirmations,
          numConfirmationsComplete,
          time,
          txID,
          type,
          ...transactionInfo,
        }}
        />

        <div className={styles.explorerLinkContainer}>
          <A
            className={styles.explorerLink}
            href={explorerURL + txID}
            title={`${t('transaction.explorerTitle')}\n${explorerURL}${txID}`}>
            <ExternalLink />
            {' '}
            {t('transaction.explorerTitle')}
          </A>
        </div>

        {isRBFEligible && (
          <div className={styles.speedUpContainer}>
            <Button
              primary
              className={styles.speedUpButton}
              onClick={handleSpeedUp}>
              <FastForwardWhite className={styles.speedUpIcon} />
              {t('transaction.speedUp')}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
