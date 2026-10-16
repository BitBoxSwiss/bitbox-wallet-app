// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAppState } from '@/contexts/app-state-context';
import { Header } from '@/components/layout';
import { isBitcoinOnly } from '@/utils/coin';
import { View, ViewContent } from '@/components/view/view';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';

export const ReceiveAccountsSelector = () => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { activeAccounts } = useAppState();
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
      <Header title={title} />
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
