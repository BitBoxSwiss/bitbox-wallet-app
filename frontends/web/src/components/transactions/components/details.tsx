import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { A } from '../../anchor/anchor';
import { Dialog } from '../../dialog/dialog';
import { FiatConversion } from '../../rates/rates';
import { Amount } from '../../../components/amount/amount';
import { Note } from '../note';
import { TxDetail } from './detail';
import { Arrow } from './arrow';
import { TxDate } from './date';
import { TxStatus } from './status';
import { AddressOrTxID } from './address-or-txid';
import parentStyle from '../transaction.module.css';

type TProps = {
  open: boolean;
  onClose: () => void;
  accountCode: string;
  internalID: string;
  note: string;
  status: accountApi.TTxStatus;
  type: accountApi.TTxType;
  numConfirmations: number;
  numConfirmationsComplete: number;
  time: string | null;
  amount: accountApi.IAmount;
  sign: string;
  typeClassName: string;
  feeRatePerKb: accountApi.IAmount;
  explorerURL: string;
}

export const TxDetailsDialog = ({
  open,
  onClose,
  accountCode,
  internalID,
  note,
  status,
  type,
  numConfirmations,
  numConfirmationsComplete,
  time,
  amount,
  sign,
  typeClassName,
  feeRatePerKb,
  explorerURL,
}: TProps) => {
  const { t } = useTranslation();

  const transactionInfo = useRef<accountApi.ITransaction | null>();

  useEffect(() => {
    if (!transactionInfo.current) {
      accountApi.getTransaction(accountCode, internalID).then(transaction => {
        if (!transaction) {
          console.error('Unable to retrieve transaction ' + internalID);
        }
        transactionInfo.current = transaction;
      }).catch(console.error);
    }
  }, [accountCode, internalID]);

  // Amount and Confirmations info are displayed using props data
  // instead of transactionInfo because they are live updated.
  return (
    <Dialog
      open={open && !!transactionInfo.current}
      title={t('transaction.details.title')}
      onClose={onClose}
      slim
      medium>
      {transactionInfo.current && (
        <>
          <Note
            accountCode={accountCode}
            internalID={internalID}
            note={note}
          />
          <TxDetail label={t('transaction.details.type')}>
            <Arrow
              status={status}
              type={type}
            />
          </TxDetail>
          <TxDetail label={t('transaction.confirmation')}>{numConfirmations}</TxDetail>
          <TxStatus
            status={status}
            numConfirmations={numConfirmations}
            numConfirmationsComplete={numConfirmationsComplete}
            detail
          />
          <TxDate time={time} detail />
          <TxDetail label={t('transaction.details.fiat')}>
            <span className={`${parentStyle.fiat} ${typeClassName}`}>
              <FiatConversion amount={amount} sign={sign} noAction />
            </span>
          </TxDetail>
          <TxDetail label={t('transaction.details.fiatAtTime')}>
            <span className={`${parentStyle.fiat} ${typeClassName}`}>
              {transactionInfo.current.amountAtTime ?
                <FiatConversion amount={transactionInfo.current.amountAtTime} sign={sign} noAction />
                :
                <FiatConversion noAction />
              }
            </span>
          </TxDetail>
          <TxDetail label={t('transaction.details.amount')}>
            <span className={`${parentStyle.amount} ${typeClassName}`}>
              {sign}
              <Amount amount={amount.amount} unit={amount.unit} />
            </span>
            {' '}
            <span className={`${parentStyle.currencyUnit} ${typeClassName}`}>{transactionInfo.current.amount.unit}</span>
          </TxDetail>
          {
            transactionInfo.current.fee && transactionInfo.current.fee.amount ? (
              <TxDetail
                label={t('transaction.fee')}
                title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''}
              >
                <Amount amount={transactionInfo.current.fee.amount} unit={transactionInfo.current.fee.unit} />
                {' '}
                <span className={parentStyle.currencyUnit}>{transactionInfo.current.fee.unit}</span>
              </TxDetail>
            ) : (
              <TxDetail label={t('transaction.fee')}>---</TxDetail>
            )
          }
          <AddressOrTxID
            label={t('transaction.details.address')}
            addresses={transactionInfo.current.addresses}
            detail
          />
          {
            transactionInfo.current.gas ? (
              <TxDetail label={t('transaction.gas')}>{transactionInfo.current.gas}</TxDetail>
            ) : null
          }
          {
            transactionInfo.current.nonce ? (
              <TxDetail label="Nonce">{transactionInfo.current.nonce}</TxDetail>
            ) : null
          }
          {
            transactionInfo.current.weight ? (
              <TxDetail label={t('transaction.weight')}>
                {transactionInfo.current.weight}
                {' '}
                <span className={parentStyle.currencyUnit}>WU</span>
              </TxDetail>
            ) : null
          }
          {
            transactionInfo.current.vsize ? (
              <TxDetail label={t('transaction.vsize')}>
                {transactionInfo.current.vsize}
                {' '}
                <span className={parentStyle.currencyUnit}>b</span>
              </TxDetail>
            ) : null
          }
          {
            transactionInfo.current.size ? (
              <TxDetail label={t('transaction.size')}>
                {transactionInfo.current.size}
                {' '}
                <span className={parentStyle.currencyUnit}>b</span>
              </TxDetail>
            ) : null
          }
          <AddressOrTxID
            label={t('transaction.explorer')}
            txid={transactionInfo.current.txID}
            detail
          />
          <div className={`${parentStyle.detail} flex-center`}>
            <A
              href={explorerURL + transactionInfo.current.txID}
              title={`${t('transaction.explorerTitle')}\n${explorerURL}${transactionInfo.current.txID}`}>
              {t('transaction.explorerTitle')}
            </A>
          </div>
        </>
      )}
    </Dialog>
  );
};
