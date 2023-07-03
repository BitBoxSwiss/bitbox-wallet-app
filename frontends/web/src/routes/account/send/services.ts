import { i18n } from '../../../i18n/i18n';
import { Fiat, IAccount, getReceiveAddressList } from '../../../api/account';
import { apiGet } from '../../../utils/request';
import { TPayload } from '../../../utils/websocket';
import { isBitcoinBased } from '../utils';
import { getDeviceInfo } from '../../../api/bitbox01';
import { alertUser } from '../../../components/alert/Alert';

export const convertToFiatService = async (coinCode: string, fiatUnit: Fiat, value?: string | boolean) => {
  const { t } = i18n;
  const data = value ? await apiGet(`coins/convert-to-plain-fiat?from=${coinCode}&to=${fiatUnit}&amount=${value}`) : null;
  if (!data) {
    return { fiatAmount: '' };
  }
  if (!data.success) {
    return { amountError: t('send.error.invalidAmount') };
  }
  return { fiatAmount: data.fiatAmount };
};

export const convertFromFiatService = async (coinCode: string, fiatUnit: Fiat, value?: string | boolean) => {
  const { t } = i18n;
  const data = value ? await apiGet(`coins/convert-from-fiat?from=${fiatUnit}&to=${coinCode}&amount=${value}`) : null;
  if (!data) {
    return { amount: '' };
  }
  if (!data.success) {
    return { amountError: t('send.error.invalidAmount') };
  }
  return { amount: data.amount };
};

export const getTransactionStatusUpdate = (payload: TPayload) => {
  if ('type' in payload) {
    const { data, meta, type } = payload;
    if (type === 'device') {
      switch (data) {
      case 'signProgress':
        return { signProgress: meta, signConfirm: false };
      case 'signConfirm':
        return { signConfirm: true };
      }
    }
  }
  return {};
};


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


export const getSelfSendAddress = async (accountCode: string): Promise<string | null> => {
  try {
    const receiveAddresses = await getReceiveAddressList(accountCode)();
    if (receiveAddresses && receiveAddresses.length > 0 && receiveAddresses[0].addresses.length > 1) {
      return receiveAddresses[0].addresses[0].address;
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
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