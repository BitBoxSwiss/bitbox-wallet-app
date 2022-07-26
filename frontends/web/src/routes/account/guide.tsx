/**
 * Copyright 2022 Shift Crypto AG
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
import { IAccount, ISigningConfigurationList } from '../../api/account';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { isBitcoinBased, isBTCScriptType } from './utils';

type Props = {
  account: IAccount;
  accountInfo?: ISigningConfigurationList;
  unit?: string;
  hasNoBalance?: boolean;
  hasIncomingBalance?: boolean;
  hasTransactions?: boolean;
};

export function AccountGuide({
  account,
  accountInfo,
  unit,
  hasNoBalance,
  hasIncomingBalance,
  hasTransactions,
}: Props) {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="accountDescription" entry={t('guide.accountDescription')} />
      {isBTCScriptType('p2pkh', account, accountInfo) && (
        <Entry key="guide.settings.btc-p2pkh" entry={t('guide.settings.btc-p2pkh')} />
      )}
      {isBTCScriptType('p2wpkh-p2sh', account, accountInfo) && (
        <Entry key="guide.settings.btc-p2sh" entry={{
          link: {
            text: t('guide.settings.btc-p2sh.link.text'),
            url: 'https://bitcoincore.org/en/2016/01/26/segwit-benefits/'
          },
          text: t('guide.settings.btc-p2sh.text'),
          title: t('guide.settings.btc-p2sh.title')
        }} />
      )}
      {isBTCScriptType('p2wpkh', account, accountInfo) && (
        <Entry key="guide.settings.btc-p2wpkh" entry={{
          link: {
            text: t('guide.settings.btc-p2wpkh.link.text'),
            url: 'https://en.bitcoin.it/wiki/Bech32_adoption'
          },
          text: t('guide.settings.btc-p2wpkh.text'),
          title: t('guide.settings.btc-p2wpkh.title')
        }} />
      )}
      {hasNoBalance && (
        <Entry key="accountSendDisabled" entry={t('guide.accountSendDisabled', {
          unit
        })} />
      )}
      <Entry key="accountReload" entry={t('guide.accountReload')} />
      {hasTransactions && (
        <Entry key="accountTransactionLabel" entry={t('guide.accountTransactionLabel')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionTime" entry={t('guide.accountTransactionTime')} />
      )}
      {isBTCScriptType('p2pkh', account, accountInfo) && (
        <Entry key="accountLegacyConvert" entry={t('guide.accountLegacyConvert')} />
      )}
      {hasTransactions && (
        <Entry key="accountTransactionAttributesGeneric" entry={t('guide.accountTransactionAttributesGeneric')} />
      )}
      {hasTransactions && isBitcoinBased(account.coinCode) && (
        <Entry key="accountTransactionAttributesBTC" entry={t('guide.accountTransactionAttributesBTC')} />
      )}
      {hasIncomingBalance && (
        <Entry key="accountIncomingBalance" entry={t('guide.accountIncomingBalance')} />
      )}
      <Entry key="accountTransactionConfirmation" entry={t('guide.accountTransactionConfirmation')} />
      <Entry key="accountFiat" entry={t('guide.accountFiat')} />

      { /* careful, also used in Settings */ }
      <Entry key="accountRates" entry={{
        link: {
          text: 'www.coingecko.com',
          url: 'https://www.coingecko.com/'
        },
        text: t('guide.accountRates.text'),
        title: t('guide.accountRates.title')
      }} />

      <Entry key="cointracking" entry={{
        link: {
          text: 'CoinTracking',
          url: 'https://cointracking.info/import/bitbox/?ref=BITBOX',
        },
        text: t('guide.cointracking.text'),
        title: t('guide.cointracking.title')
      }} />
    </Guide>
  );
}
