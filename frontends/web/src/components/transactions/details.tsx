// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react';
import type { AccountCode, CoinCode, TTransaction } from '@/api/account';
import { getTransaction } from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { usePrevious } from '@/hooks/previous';
import { TxDetailsDialog } from '@/components/transactions/components/tx-detail-dialog/tx-detail-dialog';

type TProps = {
  accountCode: AccountCode;
  coinCode: CoinCode;
  explorerURL: string;
  internalID: TTransaction['internalID'] | null;
  onClose: () => void;
};

export const TransactionDetails = ({
  accountCode,
  coinCode,
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

  const fetchTransaction = useCallback(() => {
    if (!internalID) {
      return;
    }
    const currentID = internalID;
    getTransaction(accountCode, internalID)
      .then(transaction => {
        if (internalID !== currentID) {
          return; // Ignore if internalID has changed since the request was made.
        }
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
    fetchTransaction();
  }, [fetchTransaction]);

  useEffect(() => {
    return syncdone(accountCode, fetchTransaction);
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
      coinCode={coinCode}
      explorerURL={explorerURL}
      {...transactionInfo}
    />
  );
};
