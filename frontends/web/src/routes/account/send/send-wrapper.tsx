// SPDX-License-Identifier: Apache-2.0

import type { AccountCode } from '@/api/account';
import { useAppState } from '@/contexts/app-state-context';
import { findAccount } from '@/routes/account/utils';
import { Send } from './send';

type TSendProps = {
  code: AccountCode;
};

export const SendWrapper = ({ code }: TSendProps) => {

  const {
    activeAccounts,
  } = useAppState();

  const account = findAccount(activeAccounts, code);

  return (
    account ? (
      <Send
        account={account}
        activeAccounts={activeAccounts}
      />
    ) : null
  );
};
