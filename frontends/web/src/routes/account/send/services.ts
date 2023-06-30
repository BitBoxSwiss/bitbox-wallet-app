import { i18n } from '../../../i18n/i18n';
import { Fiat } from '../../../api/account';
import { apiGet } from '../../../utils/request';

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