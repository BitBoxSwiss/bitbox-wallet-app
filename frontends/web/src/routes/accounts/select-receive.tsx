// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TAccountsByKeystore } from '@/api/account';
import { Header } from '@/components/layout';
import { isBitcoinOnly } from '@/routes/account/utils';
import { View, ViewContent } from '@/components/view/view';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';

type TReceiveAccountsSelector = {
  activeAccountsByKeystore: TAccountsByKeystore[];
};
export const ReceiveAccountsSelector = ({ activeAccountsByKeystore }: TReceiveAccountsSelector) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const handleProceed = () => {
    navigate(`/account/${code}/receive`);
  };

  const hasOnlyBTCAccounts = activeAccountsByKeystore.every(({ accounts }) =>
    accounts.every(({ coinCode }) => isBitcoinOnly(coinCode))
  );

  const title = t('generic.receive', {
    context: hasOnlyBTCAccounts ? 'bitcoin' : 'crypto'
  });

  return (
    <>
      <Header title={<h2>{title}</h2>} />
      <View width="550px" verticallyCentered fullscreen={false}>
        <ViewContent>
          {activeAccountsByKeystore.length > 0 && (
            <GroupedAccountSelector
              title={t('receive.selectAccount')}
              accountsByKeystore={activeAccountsByKeystore}
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
