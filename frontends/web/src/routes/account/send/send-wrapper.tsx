// SPDX-License-Identifier: Apache-2.0

import type { AccountCode, TAccount } from '@/api/account';
import { findAccount } from '@/routes/account/utils';
import { Send } from './send';

type TSendProps = {
  activeAccounts: TAccount[];
  code: AccountCode;
};

export const SendWrapper = ({ activeAccounts, code }: TSendProps) => {
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
