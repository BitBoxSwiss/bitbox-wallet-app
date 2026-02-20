// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { CoinCode, FeeTargetCode, TAmountWithConversions } from '@/api/account';
import type { TSelectedUTXOs } from '../../utxos';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { customFeeUnit } from '@/routes/account/utils';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '../fiat-value';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './confirm.module.css';

type TUTXOsByAddress = {
  [address: string]: string[];
};

const groupUTXOsByAddress = (selectedUTXOs: TSelectedUTXOs): TUTXOsByAddress => {
  const utxosByAddress: TUTXOsByAddress = {};
  for (const [outpoint, address] of Object.entries(selectedUTXOs)) {
    if (!utxosByAddress[address]) {
      utxosByAddress[address] = [];
    }
    utxosByAddress[address].push(outpoint);
  }
  return utxosByAddress;
};

type TransactionDetails = {
  selectedReceiverAccountNumber?: number;
  selectedReceiverAccountName?: string;
  proposedAmount?: TAmountWithConversions;
  proposedFee?: TAmountWithConversions;
  proposedTotal?: TAmountWithConversions;
  feeTarget?: FeeTargetCode;
  customFee: string;
  recipientAddress: string;
};

type TConfirmSendProps = {
  note: string;
  hasSelectedUTXOs: boolean;
  isConfirming: boolean;
  selectedUTXOs: TSelectedUTXOs;
  coinCode: CoinCode;
  transactionDetails: TransactionDetails;
};

export const ConfirmSend = ({
  note,
  hasSelectedUTXOs,
  isConfirming,
  selectedUTXOs,
  coinCode,
  transactionDetails,
}: TConfirmSendProps) => {

  const { t } = useTranslation();

  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    selectedReceiverAccountName,
    selectedReceiverAccountNumber,
    recipientAddress,
  } = transactionDetails;

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen width="840px">
      <UseDisableBackButton />
      <ViewHeader title={<div className={style.title}>{t('send.confirm.title')}</div>} />
      <ViewContent>
        <Message type="info">
          {t('send.confirm.infoMessage')}
        </Message>
        <div className={style.bitBoxContainer}>
          <PointToBitBox02 />
        </div>

        {/*Send amount*/}
        <div className={style.confirmItem}>
          <label>{t('generic.send')}</label>
          <div className={style.confirmationItemWrapper}>
            <p className={style.valueOriginalLarge}>
              <AmountWithUnit
                amount={proposedAmount}
                enableRotateUnit
                unitClassName={style.unit}
              />
            </p>
            <FiatValue
              amount={proposedAmount}
              enableRotateUnit
            />
          </div>
        </div>

        {/*To (recipient address)*/}
        <div className={style.confirmItem}>
          <label>{t('send.confirm.to')}</label>
          <div className={style.toWrapper}>
            <p className={`${style.valueOriginal || ''}`}>
              {selectedReceiverAccountName
                ? selectedReceiverAccountName
                : recipientAddress
              }
              {' '}
              {selectedReceiverAccountNumber !== undefined && (
                <span className={style.address}>
                  (Account #{selectedReceiverAccountNumber})
                </span>
              )}
            </p>
            {selectedReceiverAccountName && (
              <span className={style.address}>
                {recipientAddress}
              </span>
            )}
          </div>
        </div>

        {/*Note*/}
        {note ? (
          <div className={style.confirmItem}>
            <label>{t('note.title')}</label>
            <p className={style.valueOriginal}>
              {note}
            </p>
          </div>
        ) : null}

        {/*Selected UTXOs grouped by address*/}
        { hasSelectedUTXOs && (
          <div className={style.confirmItem}>
            <label>{t('send.confirm.selected-coins')}</label>
            <div>
              { Object.entries(groupUTXOsByAddress(selectedUTXOs)).map(([address, outpoints]) => (
                <div key={address} className={style.addressGroup}>
                  <div className={style.address}>
                    {address}
                  </div>
                  <ul>
                    {outpoints.map((outpoint) => (
                      <li key={outpoint} className={style.valueOriginal}>
                        {outpoint}
                      </li>
                    ))}
                  </ul>
                </div>
              )) }
            </div>
          </div>
        )}

        {/*Fee*/}
        <div className={style.confirmItem}>
          <label>{t('send.fee.label')}{feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}</label>
          <div className={style.confirmationItemWrapper}>
            <p className={style.valueOriginal}>
              <AmountWithUnit
                amount={proposedFee}
                alwaysShowAmounts
                enableRotateUnit
                unitClassName={style.unit}
              />
              {' '}
              {customFee ? (
                <small>
                  <br/>
                  ({customFee} {customFeeUnit(coinCode)})
                </small>
              ) : null}
            </p>
            <FiatValue
              amount={proposedFee}
              enableRotateUnit
            />
          </div>
        </div>

        {/*Total*/}
        <div className={style.confirmItem}>
          <div className={style.totalWrapper}>
            <label>{t('send.confirm.total')}</label>
            <p className={style.valueOriginal}>
              <strong>
                <AmountWithUnit amount={proposedTotal} alwaysShowAmounts enableRotateUnit />
              </strong>
            </p>
            <FiatValue
              className={style.totalFiatValue}
              amount={proposedTotal}
              enableRotateUnit
            />
          </div>
        </div>

      </ViewContent>
    </View>
  );
};
