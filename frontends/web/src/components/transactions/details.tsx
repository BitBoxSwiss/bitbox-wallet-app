// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react';
import type { AccountCode, TTransaction } from '@/api/account';
import { getTransaction } from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { usePrevious } from '@/hooks/previous';
import { TxDetailsDialog } from '@/components/transactions/components/tx-detail-dialog/tx-detail-dialog';

type TProps = {
  accountCode: AccountCode;
  explorerURL: string;
  internalID: TTransaction['internalID'] | null;
  onClose: () => void;
};

export const TransactionDetails = ({
  accountCode,
  internalID,
  explorerURL,
  onClose,
}: TProps) => {
  const [open, setOpen] = useState(false);
  const [transactionInfo, setTransactionInfo] = useState<TTransaction | null>(null);
  const prevInternalID = usePrevious(internalID);

  useEffect(() => setOpen(false), [accountCode]);

  useEffect(() => {
    if (prevInternalID !== internalID) {
      setTransactionInfo(null);
    }
  }, [internalID, prevInternalID]);

  const fetchTransaction = useCallback((isActive: () => boolean) => {
    if (!internalID || !isActive()) {
      return;
    }
    getTransaction(accountCode, internalID)
      .then(result => {
        // Ignore responses after the account or transaction changes, or the component unmounts.
        if (!isActive()) {
          return;
        }
        if (!result.success) {
          console.error(result.errorMessage);
          return;
        }
        const transaction = result.transaction;
        if (!transaction) {
          console.error(`Unable to retrieve transaction ${internalID}`);
          return;
        }
        setTransactionInfo(transaction);
        setOpen(true);
      })
      .catch(console.error);
  }, [accountCode, internalID]);

  useEffect(() => {
    let active = true;
    fetchTransaction(() => active);
    return () => {
      active = false;
    };
  }, [fetchTransaction]);

  useEffect(() => {
    let active = true;
    const unsubscribe = syncdone(accountCode, () => fetchTransaction(() => active));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [accountCode, fetchTransaction]);

  if (!transactionInfo) {
    return null;
  }

  return (
    <TxDetailsDialog
      open={open}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      accountCode={accountCode}
      explorerURL={explorerURL}
      {...transactionInfo}
    />
  );
};
