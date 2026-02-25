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
          <Column className={style.confirmItem}>
            <span className={style.valueOriginalLarge}>
              <AmountWithUnit
                amount={proposedAmount}
                enableRotateUnit
                unitClassName={style.unit}
              />
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <FiatValue
              amount={proposedAmount}
              className={style.valueOriginalLarge}
              enableRotateUnit
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
                : recipientAddress
              }
              {' '}
              {selectedReceiverAccountNumber !== undefined && (
                <span className={style.address}>
                  (Account #{selectedReceiverAccountNumber})
                </span>
              )}
            </span>
            {selectedReceiverAccountName && (
              <span className={style.address}>
                {recipientAddress}
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
          <Column className={style.confirmItem}>
            <span>
              <AmountWithUnit
                amount={proposedFee}
                alwaysShowAmounts
                enableRotateUnit
                unitClassName={style.unit}
              />
              {' '}
              {customFee ? (
                <small>
                  <br />
                  ({customFee} {customFeeUnit(coinCode)})
                </small>
              ) : null}
            </span>
          </Column>
          <Column className={style.confirmItem}>
            <FiatValue
              amount={proposedFee}
              enableRotateUnit
            />
          </Column>

          {/* Total */}
          <Column col="2">
            <span className={style.label}>
              {t('send.confirm.total')}
            </span>
          </Column>
          <Column className={style.valueOriginalLarge}>
            <AmountWithUnit
              amount={proposedTotal}
              alwaysShowAmounts
              enableRotateUnit
              unitClassName={style.unit}
            />
          </Column>
          <Column className={style.valueOriginalLarge}>
            <FiatValue
              className={style.totalFiatValue}
              amount={proposedTotal}
              enableRotateUnit
            />
          </Column>

        </Grid>
      </ViewContent>
    </View>
  );
};
