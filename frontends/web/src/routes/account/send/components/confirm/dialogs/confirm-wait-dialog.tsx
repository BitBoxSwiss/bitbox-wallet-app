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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { syncSignProgress, TSignProgress } from '@/api/devicessync';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { Amount } from '@/components/amount/amount';
import { customFeeUnit } from '@/routes/account/utils';
import { TConfirmSendProps } from '@/routes/account/send/components/confirm/types';
import style from './confirm-wait-dialog.module.css';

export const ConfirmingWaitDialog = ({
  baseCurrencyUnit,
  note,
  hasSelectedUTXOs,
  isConfirming,
  selectedUTXOs,
  coinCode,
  transactionDetails
}: Omit<TConfirmSendProps, 'bb01Paired'>) => {
  const { t } = useTranslation();
  const [signProgress, setSignProgress] = useState<TSignProgress>();

  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    recipientAddress,
    activeCurrency
  } = transactionDetails;

  // Reset the signProgress state every time the dialog was closed (after send/abort).
  const [prevIsConfirming, setPrevIsConfirming] = useState(isConfirming);
  if (prevIsConfirming != isConfirming) {
    setPrevIsConfirming(isConfirming);
    if (!isConfirming) {
      setSignProgress(undefined);
    }
  }

  useEffect(() => {
    return syncSignProgress(setSignProgress);
  }, []);

  if (!isConfirming) {
    return null;
  }

  const confirmPrequel = (signProgress && signProgress.steps > 1) ? (
    <span>
      {
        t('send.signprogress.description', {
          steps: signProgress.steps.toString(),
        })
      }
      <br />
      {t('send.signprogress.label')}: {signProgress.step}/{signProgress.steps}
    </span>
  ) : undefined;

  return (
    <WaitDialog
      title={t('send.confirm.title')}
      prequel={confirmPrequel}
      includeDefault>
      <div className={style.confirmItem}>
        <label>{t('send.address.label')}</label>
        <p>{recipientAddress || 'N/A'}</p>
      </div>
      <div className={style.confirmItem}>
        <label>{t('send.amount.label')}</label>
        <p>
          <span key="proposedAmount">
            {(proposedAmount &&
              <Amount alwaysShowAmounts amount={proposedAmount.amount} unit={proposedAmount.unit}/>) || 'N/A'}
            {' '}
            <small>{(proposedAmount && proposedAmount.unit) || 'N/A'}</small>
          </span>
          {
            proposedAmount && proposedAmount.conversions && proposedAmount.conversions[activeCurrency] && (
              <span>
                <span className="text-gray"> / </span>
                <Amount alwaysShowAmounts amount={proposedAmount.conversions[activeCurrency]} unit={baseCurrencyUnit}/>
                {' '}<small>{baseCurrencyUnit}</small>
              </span>)
          }
        </p>
      </div>
      {note ? (
        <div className={style.confirmItem}>
          <label>{t('note.title')}</label>
          <p>{note}</p>
        </div>
      ) : null}
      <div className={style.confirmItem}>
        <label>{t('send.fee.label')}{feeTarget ? ' (' + t(`send.feeTarget.label.${feeTarget}`) + ')' : ''}</label>
        <p>
          <span key="amount">
            {(proposedFee &&
              <Amount alwaysShowAmounts amount={proposedFee.amount} unit={proposedFee.unit}/>) || 'N/A'}
            {' '}
            <small>{(proposedFee && proposedFee.unit) || 'N/A'}</small>
          </span>
          {proposedFee && proposedFee.conversions && proposedFee.conversions[activeCurrency] && (
            <span key="conversation">
              <span className="text-gray"> / </span>
              <Amount alwaysShowAmounts amount={proposedFee.conversions[activeCurrency]} unit={baseCurrencyUnit}/>
              {' '}<small>{baseCurrencyUnit}</small>
            </span>
          )}
          {customFee ? (
            <span key="customFee">
              <br/>
              <small>({customFee} {customFeeUnit(coinCode)})</small>
            </span>
          ) : null}
        </p>
      </div>
      {
        hasSelectedUTXOs && (
          <div className={[style.confirmItem].join(' ')}>
            <label>{t('send.confirm.selected-coins')}</label>
            {
              selectedUTXOs.map((uxto, i) => (
                <p className={style.confirmationValue} key={`selectedCoin-${i}`}>{uxto}</p>
              ))
            }
          </div>
        )
      }
      <div className={[style.confirmItem, style.total].join(' ')}>
        <label>{t('send.confirm.total')}</label>
        <p>
          <span>
            <strong>
              {(proposedTotal &&
              <Amount alwaysShowAmounts amount={proposedTotal.amount} unit={proposedTotal.unit}/>) || 'N/A'}
            </strong>
            {' '}
            <small>{(proposedTotal && proposedTotal.unit) || 'N/A'}</small>
          </span>
          {(proposedTotal && proposedTotal.conversions) && proposedTotal.conversions[activeCurrency] && (
            <span>
              <span className="text-gray"> / </span>
              <strong><Amount alwaysShowAmounts amount={proposedTotal.conversions[activeCurrency]} unit={baseCurrencyUnit}/></strong>
              {' '}<small>{baseCurrencyUnit}</small>
            </span>
          )}
        </p>
      </div>
    </WaitDialog>
  )
  ;
};

