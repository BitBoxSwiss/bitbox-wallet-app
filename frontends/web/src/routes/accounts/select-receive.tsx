/**
 * Copyright 2023-2024 Shift Crypto AG
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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IAccount } from '@/api/account';
import { Header } from '@/components/layout';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';

type TReceiveAccountsSelector = {
  activeAccounts: IAccount[];
};
export const ReceiveAccountsSelector = ({
  activeAccounts,
}: TReceiveAccountsSelector) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const handleProceed = () => {
    navigate(`/account/${code}/receive`);
  };

  const hasOnlyBTCAccounts = activeAccounts.every(({ coinCode }) =>
    isBitcoinOnly(coinCode),
  );

  const title = t('generic.receive', {
    context: hasOnlyBTCAccounts ? 'bitcoin' : 'crypto',
  });

  return (
    <>
      <Header title={<h2>{title}</h2>} />
      <View width="550px" verticallyCentered fullscreen={false}>
        <ViewContent>
          {activeAccounts && activeAccounts.length > 0 && (
            <GroupedAccountSelector
              title={t('receive.selectAccount')}
              accounts={activeAccounts}
              selected={code}
              onChange={setCode}
              onProceed={handleProceed}
            />
          )}
        </ViewContent>
      </View>
    </>
  );
};
