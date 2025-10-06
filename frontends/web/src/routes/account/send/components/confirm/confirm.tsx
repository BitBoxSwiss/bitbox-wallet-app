/**
 * Copyright 2024 Shift Crypto AG
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
import { CoinCode, ConversionUnit, FeeTargetCode, Fiat, TAmountWithConversions } from '@/api/account';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { Amount } from '@/components/amount/amount';
import { customFeeUnit } from '@/routes/account/utils';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { FiatValue } from '../fiat-value';
import type { TSelectedUTXOs } from '../../utxos';
import style from './confirm.module.css';

type TransactionDetails = {
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
  transactionDetails: TransactionDetails;
}

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
  transactionDetails
}: TConfirmSendProps) => {

  const { t } = useTranslation();
  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    recipientAddress,
    activeCurrency: fiatUnit
  } = transactionDetails;

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
          <label>{t('button.send')}</label>
          <div className={style.confirmationItemWrapper}>
            <p className={style.valueOriginalLarge}>
              {(proposedAmount &&
              <Amount alwaysShowAmounts amount={proposedAmount.amount} unit={proposedAmount.unit}/>) || 'N/A'}
              {' '}
              <span className={style.unit}>
                {(proposedAmount && proposedAmount.unit) || 'N/A'}
              </span>
            </p>
            {canShowSendAmountFiatValue &&
            (<FiatValue baseCurrencyUnit={baseCurrencyUnit} amount={proposedAmount.conversions![fiatUnit] || ''} />)
            }
          </div>
        </div>

        {/*To (recipient address)*/}
        <div className={style.confirmItem}>
          <label>{t('send.confirm.to')}</label>
          <div className={style.confirmationItemWrapper}>
            <p className={style.valueOriginal}>
              {recipientAddress || 'N/A'}
            </p>
          </div>
        </div>

        {/*Note*/}
        {note ? (
          <div className={style.confirmItem}>
            <label>{t('note.title')}</label>
            <p className={style.valueOriginal}>{note}</p>
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
              {(proposedFee &&
              <Amount alwaysShowAmounts amount={proposedFee.amount} unit={proposedFee.unit}/>) || 'N/A'} {' '}
              <span className={style.unit}>
                {(proposedFee && proposedFee.unit) || 'N/A'}
              </span>
              {customFee ? (
                <small>
                  <br/>
                  ({customFee} {customFeeUnit(coinCode)})
                </small>
              ) : null}
            </p>
            {canShowFeeFiatValue && (
              <FiatValue baseCurrencyUnit={baseCurrencyUnit} amount={proposedFee.conversions![fiatUnit] || ''} />
            )}
          </div>
        </div>

        {/*Total*/}
        <div className={style.confirmItem}>
          <div className={style.totalWrapper}>
            <label>{t('send.confirm.total')}</label>
            <p className={style.valueOriginal}>
              <strong>
                {(proposedTotal &&
              <Amount alwaysShowAmounts amount={proposedTotal.amount} unit={proposedTotal.unit}/>) || 'N/A'}
              </strong>
              {' '}
              <span className={style.unit}>{(proposedTotal && proposedTotal.unit) || 'N/A'}</span>
            </p>
            {canShowTotalFiatValue && (
              <FiatValue
                className={style.totalFiatValue}
                baseCurrencyUnit={baseCurrencyUnit}
                amount={proposedTotal.conversions![fiatUnit] || ''}
              />
            )}
          </div>
        </div>

      </ViewContent>
    </View>
  );

};
