import { useTranslation } from 'react-i18next';
import { WaitDialog } from '../../../../../components/wait-dialog/wait-dialog';

import { CoinOrTokenCode, ConversionUnit, FeeTargetCode, Fiat, IAmount } from '../../../../../api/account';
import { Amount } from '../../../../../components/amount/amount';
import { customFeeUnit } from '../../../utils';
import style from './confirm-wait-dialog.module.css';
import { TSignProgress } from '../../../../../api/devicessync';

type TransactionStatus = {
  isConfirming: boolean;
  signConfirm: boolean;
  signProgress?: TSignProgress;
}

type TransactionDetails = {
  proposedAmount?: IAmount;
  proposedFee?: IAmount;
  proposedTotal?: IAmount;
  feeTarget?: FeeTargetCode;
  customFee: string;
  recipientAddress: string;
  fiatUnit: Fiat;
}

type TProps = {
  paired?: boolean;
  baseCurrencyUnit: ConversionUnit;
  note: string;
  hasSelectedUTXOs: boolean;
  selectedUTXOs: string[];
  coinCode: CoinOrTokenCode;
  transactionStatus: TransactionStatus;
  transactionDetails: TransactionDetails;

}
export const ConfirmingWaitDialog = ({
  paired,
  baseCurrencyUnit,
  note,
  hasSelectedUTXOs,
  selectedUTXOs,
  coinCode,
  transactionStatus,
  transactionDetails
}: TProps) => {
  const { t } = useTranslation();
  const { isConfirming, signConfirm, signProgress } = transactionStatus;
  const {
    proposedFee,
    proposedAmount,
    proposedTotal,
    customFee,
    feeTarget,
    recipientAddress,
    fiatUnit
  } = transactionDetails;

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
      paired={paired}
      touchConfirm={signConfirm}
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
            proposedAmount && proposedAmount.conversions && (
              <span>
                <span className="text-gray"> / </span>
                <Amount alwaysShowAmounts amount={proposedAmount.conversions[fiatUnit]} unit={baseCurrencyUnit}/>
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
          {proposedFee && proposedFee.conversions && (
            <span key="conversation">
              <span className="text-gray"> / </span>
              <Amount alwaysShowAmounts amount={proposedFee.conversions[fiatUnit]} unit={baseCurrencyUnit}/>
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
          {(proposedTotal && proposedTotal.conversions) && (
            <span>
              <span className="text-gray"> / </span>
              <strong><Amount alwaysShowAmounts amount={proposedTotal.conversions[fiatUnit]} unit={baseCurrencyUnit}/></strong>
              {' '}<small>{baseCurrencyUnit}</small>
            </span>
          )}
        </p>
      </div>
    </WaitDialog>
  )
  ;
};