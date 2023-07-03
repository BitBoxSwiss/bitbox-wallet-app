import { i18n } from '../../../i18n/i18n';
import { alertUser } from '../../../components/alert/Alert';
import { TPayload } from '../../../utils/websocket';
import { getDeviceInfo } from '../../../api/bitbox01';
import { isBitcoinBased } from '../utils';
import { IAccount } from '../../../api/account';

export const getPairingStatusBB01 = async (deviceID: string, mobileChannel: boolean, account?: IAccount) => {
  try {
    const { pairing } = await getDeviceInfo(deviceID);
    const paired = mobileChannel && pairing;
    const noMobileChannelError = pairing && !mobileChannel && account && isBitcoinBased(account.coinCode);
    return { paired, noMobileChannelError };
  } catch (error) {
    console.error(error);
    return {};
  }
};

export const getTransactionStatusUpdate = (payload: TPayload) => {
  let statusUpdate = {};
  if ('type' in payload) {
    const { data, meta, type } = payload;
    if (type === 'device') {
      switch (data) {
      case 'signProgress':
        statusUpdate = { signProgress: meta, signConfirm: false };
        break;
      case 'signConfirm':
        statusUpdate = { signConfirm: true };
        break;
      }
    }
  }
  return statusUpdate;
};

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