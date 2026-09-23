// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { CoinCode, FeeTargetCode, TAmountWithConversions } from '@/api/account';
import type { TSelectedUTXOs } from '../../utxos';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { customFeeUnit } from '@/routes/account/utils';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Column, Grid } from '@/components/layout';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '@/components/amount/fiat-value';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { getDisplayAccountNumber } from '@/routes/account/utils';
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
  recipientDisplayAddress: string;
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
    recipientDisplayAddress,
  } = transactionDetails;

  const displayReceiverAccountNumber = getDisplayAccountNumber(selectedReceiverAccountNumber);

  if (!isConfirming) {
    return null;
  }

  return (
    <View fullscreen width="840px" withMobileSafetyMargin>
      <UseDisableBackButton />
      <ViewHeader title={<div className={style.title}>{t('send.confirm.title')}</div>} />
      <ViewContent>
        <Message type="info">
          {t('send.confirm.infoMessage')}
        </Message>

        <Grid col="2">

          <Column col="2">
            <div className={style.bitBoxContainer}>
              <PointToBitBox02 />
            </div>
          </Column>

          {/* Send amount */}
          <Column col="2">
            <span className={style.label}>
              {t('generic.send')}
            </span>
          </Column>
          <Column col="2" className={`${style.confirmItem || ''} ${style.amountRow || ''} ${style.valueOriginalLarge || ''}`}>
            <AmountWithUnit
              amount={proposedAmount}
              alwaysShowAmounts
              enableRotateUnit
              unitClassName={style.unit}
              wrap
            />
            <FiatValue
              amount={proposedAmount}
              className={style.fiatValue}
              enableRotateUnit
              wrap
            />
          </Column>

          {/* To (recipient address) */}
          <Column col="2">
            <span className={style.label}>
              {t('send.confirm.to')}
            </span>
          </Column>
          <Column col="2" className={style.confirmItem}>
            <span>
              {selectedReceiverAccountName
                ? selectedReceiverAccountName
                : recipientDisplayAddress
              }
              {' '}
              {displayReceiverAccountNumber !== undefined && (
                <span className={style.address}>
                  (Account #{displayReceiverAccountNumber})
                </span>
              )}
            </span>
            {selectedReceiverAccountName && (
              <span className={style.address}>
                {recipientDisplayAddress}
              </span>
            )}
          </Column>

          {/* Note */}
          {note ? (
            <Column col="2" className={style.confirmItem}>
              <span className={style.label}>
                {t('note.title')}
              </span>
              <span>
                {note}
              </span>
            </Column>
          ) : null}

          {/* Selected UTXOs grouped by address */}
          { hasSelectedUTXOs && (
            <Column col="2" className={style.confirmItem}>
              <span className={style.label}>
                {t('send.confirm.selected-coins')}
              </span>
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
            </Column>
          )}

          {/* Fee */}
          <Column col="2">
            <span className={style.label}>
              {t('send.fee.label')}
              {feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}
            </span>
          </Column>
          <Column col="2" className={`${style.confirmItem || ''} ${style.amountRow || ''}`}>
            <span>
              <AmountWithUnit
                amount={proposedFee}
                alwaysShowAmounts
                enableRotateUnit
                unitClassName={style.unit}
                wrap
              />
              {' '}
              {customFee ? (
                <small>
                  <br />
                  ({customFee} {customFeeUnit(coinCode)})
                </small>
              ) : null}
            </span>
            <FiatValue
              amount={proposedFee}
              className={style.fiatValue}
              enableRotateUnit
              wrap
            />
          </Column>

          {/* Total */}
          <Column col="2">
            <span className={style.label}>
              {t('send.confirm.total')}
            </span>
          </Column>
          <Column col="2" className={`${style.amountRow || ''} ${style.valueOriginalLarge || ''}`}>
            <AmountWithUnit
              amount={proposedTotal}
              alwaysShowAmounts
              enableRotateUnit
              unitClassName={style.unit}
              wrap
            />
            <FiatValue
              amount={proposedTotal}
              className={style.fiatValue}
              enableRotateUnit
              wrap
            />
          </Column>

        </Grid>
      </ViewContent>
    </View>
  );
};
