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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IAccount } from '../../api/account';
import { AccountSelector } from '../../components/accountSelector/accountselector';
import { Header } from '../../components/layout';
import { route } from '../../utils/route';
import { isBitcoinOnly } from '../account/utils';
import { View, ViewContent } from '../../components/view/view';

type TReceiveAccountsSelector = {
    activeAccounts: IAccount[]
}
export const ReceiveAccountsSelector = ({ activeAccounts }: TReceiveAccountsSelector) => {
  const [code, setCode] = useState('');

  const { t } = useTranslation();

  const handleProceed = () => {
    route(`/account/${code}/receive`);
  };

  const options = activeAccounts.map(account => ({ text: account.name, value: account.code }));

  const hasOnlyBTCAccounts = activeAccounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('receive.title', { accountName: hasOnlyBTCAccounts ? 'Bitcoin' : t('buy.info.crypto') });

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

