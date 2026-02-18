// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { CoinCode, ConversionUnit, FeeTargetCode, Fiat, TAccount, TAmountWithConversions } from '@/api/account';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { customFeeUnit } from '@/routes/account/utils';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '../fiat-value';
import type { TSelectedUTXOs } from '../../utxos';
import style from './confirm.module.css';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';

type TransactionDetails = {
  selectedReceiverAccount?: TAccount;
  proposedAmount?: TAmountWithConversions;
  proposedFee?: TAmountWithConversions;
  proposedTotal?: TAmountWithConversions;
  feeTarget?: FeeTargetCode;
  customFee: string;
  recipientAddress: string;
  activeCurrency: Fiat;
};

type TConfirmSendProps = {
  baseCurrencyUnit: ConversionUnit;
  note: string;
  hasSelectedUTXOs: boolean;
  isConfirming: boolean;
  selectedUTXOs: TSelectedUTXOs;
  coinCode: CoinCode;
  isRBF: boolean;
  transactionDetails: TransactionDetails;
};

type TUTXOsByAddress = {
  [address: string]: string[];
};

export const ConfirmSend = ({
  baseCurrencyUnit,
  note,
  hasSelectedUTXOs,
  isConfirming,
  selectedUTXOs,
  coinCode,
  isRBF,
  transactionDetails,
}: TConfirmSendProps) => {

  const { t } = useTranslation();
  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    selectedReceiverAccount,
    recipientAddress,
    activeCurrency: fiatUnit
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

  const canShowSendAmountFiatValue = proposedAmount && proposedAmount.conversions && proposedAmount.conversions[fiatUnit];
  const canShowFeeFiatValue = proposedFee && proposedFee.conversions && proposedFee.conversions[fiatUnit];
  const canShowTotalFiatValue = (proposedTotal && proposedTotal.conversions) && proposedTotal.conversions[fiatUnit];
  const feeTargetLabel = feeTarget ? t(`send.feeTarget.label.${feeTarget}`) : '';
  const displayedFeeTargetLabel = isRBF ? feeTargetLabel.toLowerCase() : feeTargetLabel;

  return (
    <View fullscreen width="840px">
      <UseDisableBackButton />
      <ViewHeader title={<div className={style.title}>{t(isRBF ? 'send.rbf.confirmTitle' : 'send.confirm.title')}</div>} />
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
                baseCurrencyUnit={baseCurrencyUnit}
                amount={proposedAmount.conversions![fiatUnit] || ''}
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
          <label>{t('send.fee.label')}{feeTarget ? ' (' + displayedFeeTargetLabel + ')' : ''}</label>
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
                baseCurrencyUnit={baseCurrencyUnit}
                amount={proposedFee.conversions![fiatUnit] || ''}
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
                baseCurrencyUnit={baseCurrencyUnit}
                amount={proposedTotal.conversions![fiatUnit] || ''}
                enableRotateUnit
              />
            )}
          </div>
        </div>

      </ViewContent>
    </View>
  );

};
