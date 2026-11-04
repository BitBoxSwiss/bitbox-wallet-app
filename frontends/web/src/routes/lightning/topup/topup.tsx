// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAppState } from '@/contexts/app-state-context';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { HideAmountsButton } from '@/components/hideamountsbutton/hideamountsbutton';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { TopUpNoBitcoinAccounts } from './topup-result';

export const LightningTopUp = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { activeAccounts, hasAccounts } = useAppState();
  const btcAccounts = useMemo(
    () => activeAccounts.filter(account => account.active && account.coinCode === 'btc'),
    [activeAccounts],
  );
  const [sourceAccountCode, setSourceAccountCode] = useState('');
  const sendLink = (code: string) => `/account/${code}/send?recipient=lightning`;
  const onBack = () => navigate('/lightning');

  if (!btcAccounts.length) {
    return <TopUpNoBitcoinAccounts hasAccounts={hasAccounts} />;
  }

  return (
    <Main>
      <Header
        variant="navigation"
        mobileBackButton
        onBack={onBack}
        title={t('lightning.topUp.title')}
      >
        <HideAmountsButton />
      </Header>
      <View width="550px" verticallyCentered fullscreen={false}>
        <ViewContent>
          <GroupedAccountSelector
            title={t('lightning.topUp.selectAccount')}
            accounts={btcAccounts}
            selected={sourceAccountCode}
            onChange={setSourceAccountCode}
            onProceed={() => navigate(sendLink(sourceAccountCode))}
            onSingleAccount={code => navigate(sendLink(code), { replace: true })}
            requireAvailableBalance
          />
          <DesktopBackButton onClick={onBack}>{t('button.back')}</DesktopBackButton>
        </ViewContent>
      </View>
    </Main>
  );
};
