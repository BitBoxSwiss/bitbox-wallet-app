import { alertUser } from '../../../components/alert/Alert';
import { i18n } from '../../../i18n/i18n';

export type TProposalError = {
    addressError: string;
    amountError: string;
    feeError: string;
}

type TProposalErrorHandling = TProposalError | {proposedFee: undefined}

export const txProposalErrorHandling = (registerEvents: () => void, unregisterEvents: () => void, errorCode?: string) => {
  const { t } = i18n;
  let errorHandling = {} as Partial<TProposalErrorHandling>;
  switch (errorCode) {
  case 'invalidAddress':
    errorHandling = { addressError: t('send.error.invalidAddress') };
    break;
  case 'invalidAmount':
  case 'insufficientFunds':
    errorHandling = { amountError: t(`send.error.${errorCode}`), proposedFee: undefined };
    break;
  case 'feeTooLow':
  case 'feesNotAvailable':
    errorHandling = { feeError: t(`send.error.${errorCode}`) };
    break;
  default:
    if (errorCode) {
      unregisterEvents();
      alertUser(errorCode, { callback: registerEvents });
    }
  }
  return errorHandling;
};