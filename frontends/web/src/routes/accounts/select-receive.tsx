/**
 * Copyright 2023 Shift Crypto AG
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
import { getBalance, IAccount } from '../../api/account';
import { AccountSelector, TOption } from '../../components/accountselector/accountselector';
import { Header } from '../../components/layout';
import { route } from '../../utils/route';
import { isBitcoinOnly } from '../account/utils';
import { View, ViewContent } from '../../components/view/view';

type TReceiveAccountsSelector = {
  activeAccounts: IAccount[]
}
export const ReceiveAccountsSelector = ({ activeAccounts }: TReceiveAccountsSelector) => {
  const [options, setOptions] = useState<TOption[]>([]);
  const [code, setCode] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const options = activeAccounts.map(account => ({ label: account.name, value: account.code, disabled: false, coinCode: account.coinCode } as TOption));
    //setting options without balance
    setOptions(options);
    //asynchronously fetching each account's balance
    getBalances(options).then(options => setOptions(options));
  }, [activeAccounts]);

  const handleProceed = () => {
    route(`/account/${code}/receive`);
  };

  const hasOnlyBTCAccounts = activeAccounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('receive.title', { accountName: hasOnlyBTCAccounts ? 'Bitcoin' : t('buy.info.crypto') });

  const getBalances = async (options: TOption[]) => {
    return Promise.all(options.map((option) => (
      getBalance(option.value).then(balance => {
        return { ...option, balance: `${balance.available.amount} ${balance.available.unit}` };
      })
    )));
  };

  return (
    <>
      <Header title={<h2>{title}</h2>} />
      <View width="550px" verticallyCentered fullscreen={false}>
        <ViewContent>
          <AccountSelector onChange={setCode} onProceed={handleProceed} options={options} title={t('receive.selectAccount')} selected={code} />
        </ViewContent>
      </View>
    </>

  );
};

