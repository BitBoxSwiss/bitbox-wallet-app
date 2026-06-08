// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TAccount } from '@/api/account';
import { Header } from '@/components/layout';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';

type TReceiveAccountsSelector = {
  activeAccounts: TAccount[];
};
export const ReceiveAccountsSelector = ({ activeAccounts }: TReceiveAccountsSelector) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const handleProceed = () => {
    navigate(`/account/${code}/receive`);
  };

  const hasOnlyBTCAccounts = activeAccounts.every(({ coinCode }) => isBitcoinOnly(coinCode));

  const title = t('generic.receive', {
    context: hasOnlyBTCAccounts ? 'bitcoin' : 'crypto'
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
