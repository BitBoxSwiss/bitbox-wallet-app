// SPDX-License-Identifier: Apache-2.0

import { useLocation, useParams } from 'wouter';
import type { AccountCode } from '@/api/account';
import { useAppState } from '@/contexts/app-state-context';
import { findAccount } from '@/routes/account/utils';
import { useSearch } from '@/utils/router-compatability';
import { Send } from './send';

type TRouteParams = {
  code: AccountCode;
};

export const SendWrapper = () => {
  const { code = '' } = useParams<TRouteParams>();
  const { activeAccounts } = useAppState();
  const account = findAccount(activeAccounts, code);
  const [, navigate] = useLocation();
  const search = useSearch();
  const fixedRecipient = new URLSearchParams(search).get('recipient') === 'lightning' ? 'lightning' : undefined;
  const backToTopUp = () => navigate(
    activeAccounts.filter(account => account.active && account.coinCode === 'btc').length > 1
      ? '/lightning/topup'
      : '/lightning',
    { replace: true },
  );

  return (
    account ? (
      <Send
        key={`${account.code}-${fixedRecipient ?? ''}`}
        account={account}
        activeAccounts={activeAccounts}
        fixedRecipient={fixedRecipient}
        onBack={fixedRecipient ? backToTopUp : undefined}
        onDone={fixedRecipient ? () => navigate('/lightning') : undefined}
      />
    ) : null
  );
};
