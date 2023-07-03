import { alertUser } from '../../../components/alert/Alert';
import { i18n } from '../../../i18n/i18n';

export const txProposalErrorHandling = (errorCode: string, registerEvents: () => void, unregisterEvents: () => void) => {
  const { t } = i18n;
  let errorHandling = {};
  let transactionDetails = {};
  switch (errorCode) {
  case 'invalidAddress':
    errorHandling = { addressError: t('send.error.invalidAddress') };
    break;
  case 'invalidAmount':
  case 'insufficientFunds':
    errorHandling = { amountError: t(`send.error.${errorCode}`) };
    transactionDetails = { proposedFee: undefined };
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
  return { errorHandling, transactionDetails };
};