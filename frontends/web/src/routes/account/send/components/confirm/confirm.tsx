// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoinCode, FeeTargetCode, TAccount, TAmountWithConversions } from '@/api/account';
import type { TSelectedUTXOs } from '../../utxos';
import { RatesContext } from '@/contexts/RatesContext';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { customFeeUnit } from '@/routes/account/utils';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '../fiat-value';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import style from './confirm.module.css';

type TransactionDetails = {
  selectedReceiverAccount?: TAccount;
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

type TUTXOsByAddress = {
  [address: string]: string[];
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
  const { defaultCurrency } = useContext(RatesContext);

  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    selectedReceiverAccount,
    recipientAddress,
  } = transactionDetails;

  const receiverAccountNumberAndName = selectedReceiverAccount ?
    {
      name: selectedReceiverAccount.name,
      number: selectedReceiverAccount.accountNumber ? selectedReceiverAccount.accountNumber + 1 : null,
    }
    : undefined;

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

  if (!isConfirming) {
    return null;
  }

  const canShowSendAmountFiatValue = proposedAmount && proposedAmount.conversions && proposedAmount.conversions[defaultCurrency];
  const canShowFeeFiatValue = proposedFee && proposedFee.conversions && proposedFee.conversions[defaultCurrency];
  const canShowTotalFiatValue = (proposedTotal && proposedTotal.conversions) && proposedTotal.conversions[defaultCurrency];

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
              {proposedAmount ? (
                <AmountWithUnit
                  amount={proposedAmount}
                  enableRotateUnit
                  unitClassName={style.unit}
                />
              ) : 'N/A'}
            </p>
            {canShowSendAmountFiatValue && (
              <FiatValue
                amount={proposedAmount}
                enableRotateUnit
              />
            )}
          </div>
        </div>

        {/*To (recipient address)*/}
        <div className={style.confirmItem}>
          <label>{t('send.confirm.to')}</label>
          <div className={style.toWrapper}>
            <p className={`${style.valueOriginal || ''}`}>
              {receiverAccountNumberAndName?.name ?
                receiverAccountNumberAndName.name :
                recipientAddress
              }
              {' '}
              {receiverAccountNumberAndName?.number && (
                <span className={style.address}>
                  (Account #{receiverAccountNumberAndName.number})
                </span>
              )}
            </p>

            {receiverAccountNumberAndName && (
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
        {
          hasSelectedUTXOs && (
            <div className={style.confirmItem}>
              <label>{t('send.confirm.selected-coins')}</label>
              <div>
                {
                  Object.entries(groupUTXOsByAddress(selectedUTXOs)).map(([address, outpoints]) => (
                    <div className={style.addressGroup} key={address}>
                      <div className={style.address}>{address}</div>
                      <ul>
                        {outpoints.map((outpoint, i) => (
                          <li className={style.valueOriginal} key={`selectedCoin-${i}`}>{outpoint}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                }
              </div>
            </div>
          )
        }

        {/*Fee*/}
        <div className={style.confirmItem}>
          <label>{t('send.fee.label')}{feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}</label>
          <div className={style.confirmationItemWrapper}>
            <p className={style.valueOriginal}>
              {proposedFee && (
                <AmountWithUnit
                  amount={proposedFee}
                  alwaysShowAmounts
                  enableRotateUnit
                  unitClassName={style.unit}
                />
              ) || 'N/A'}
              {' '}
              {customFee ? (
                <small>
                  <br/>
                  ({customFee} {customFeeUnit(coinCode)})
                </small>
              ) : null}
            </p>
            {canShowFeeFiatValue && (
              <FiatValue
                amount={proposedFee}
                enableRotateUnit
              />
            )}
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
            {canShowTotalFiatValue && (
              <FiatValue
                className={style.totalFiatValue}
                amount={proposedTotal}
                enableRotateUnit
              />
            )}
          </div>
        </div>

      </ViewContent>
    </View>
  );

};
