// SPDX-License-Identifier: Apache-2.0

import { useSearchParams } from 'react-router-dom';
import type { AccountCode, TAccount } from '@/api/account';
import { findAccount } from '@/routes/account/utils';
import { Send } from './send';
import { SendRbf } from './send-rbf';

type TSendProps = {
  activeAccounts: TAccount[];
  code: AccountCode;
};

export const SendWrapper = ({ activeAccounts, code }: TSendProps) => {
  const [searchParams] = useSearchParams();
  const account = findAccount(activeAccounts, code);
  const rbfTxID = searchParams.get('rbf');

  if (!account) {
    return null;
  }

  if (rbfTxID) {
    return (
      <SendRbf
        account={account}
        rbfTxID={rbfTxID}
      />
    );
  }

  return (
    <Send
      account={account}
      activeAccounts={activeAccounts}
    />
  );
};
