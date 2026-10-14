// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { TTransaction } from '@/api/account';
import { getTransaction } from '@/api/account';
import { syncdone } from '@/api/accountsync';
import { TransactionDetails } from './details';

vi.mock('@/api/account');
vi.mock('@/api/accountsync', () => ({ syncdone: vi.fn(() => vi.fn()) }));
vi.mock('@/components/transactions/components/tx-detail-dialog/tx-detail-dialog', () => ({
  TxDetailsDialog: ({ open, note }: { open: boolean; note: string }) => (
    open ? <div role="dialog">{note}</div> : null
  ),
}));

const deferred = <T, >() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const transaction = (internalID: string, note: string): TTransaction => {
  const amount = { amount: '1', unit: 'BTC', estimated: false } as const;
  return {
    addresses: [],
    amount,
    amountAtTime: amount,
    deductedAmountAtTime: amount,
    fee: amount,
    feeRateInfo: '',
    gas: 0,
    internalID,
    nonce: null,
    note,
    numConfirmations: 1,
    numConfirmationsComplete: 1,
    size: 0,
    status: 'complete',
    time: null,
    txID: internalID,
    type: 'receive',
    vsize: 0,
    weight: 0,
  };
};

const props = {
  accountCode: 'account',
  internalID: 'transaction',
  explorerURL: '',
  onClose: vi.fn(),
};

describe('TransactionDetails', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { change: 'transaction', internalID: 'next-transaction', accountCode: 'account' },
    { change: 'account', internalID: 'transaction', accountCode: 'next-account' },
  ])('ignores a pending response after the $change changes', async ({ internalID, accountCode }) => {
    const pending = deferred<{ success: true; transaction: TTransaction }>();
    vi.mocked(getTransaction).mockReturnValueOnce(pending.promise).mockResolvedValue({
      success: true,
      transaction: transaction(internalID, 'current transaction'),
    });
    const { rerender } = render(<TransactionDetails {...props} />);

    rerender(<TransactionDetails {...props} internalID={internalID} accountCode={accountCode} />);
    expect(await screen.findByRole('dialog')).toHaveTextContent('current transaction');

    await act(async () => pending.resolve({
      success: true,
      transaction: transaction(props.internalID, 'stale transaction'),
    }));

    expect(screen.getByRole('dialog')).toHaveTextContent('current transaction');
    expect(screen.queryByText('stale transaction')).not.toBeInTheDocument();
    expect(vi.mocked(syncdone).mock.results[0]!.value).toHaveBeenCalledOnce();
  });

  it('ignores pending sync refreshes and callbacks from an obsolete subscription', async () => {
    vi.mocked(getTransaction).mockResolvedValue({
      success: true,
      transaction: transaction(props.internalID, 'initial transaction'),
    });
    const { rerender, unmount } = render(<TransactionDetails {...props} />);
    await screen.findByText('initial transaction');

    const onSync = vi.mocked(syncdone).mock.calls[0]![1];
    const pending = deferred<{ success: true; transaction: TTransaction }>();
    vi.mocked(getTransaction).mockReturnValueOnce(pending.promise);
    act(() => onSync());
    expect(getTransaction).toHaveBeenCalledTimes(2);

    vi.mocked(getTransaction).mockResolvedValue({
      success: true,
      transaction: transaction('next-transaction', 'current transaction'),
    });
    rerender(<TransactionDetails {...props} internalID="next-transaction" />);
    await screen.findByText('current transaction');
    act(() => onSync());
    expect(getTransaction).toHaveBeenCalledTimes(3);

    await act(async () => pending.resolve({
      success: true,
      transaction: transaction(props.internalID, 'stale transaction'),
    }));
    expect(screen.getByRole('dialog')).toHaveTextContent('current transaction');

    const onCurrentSync = vi.mocked(syncdone).mock.calls[1]![1];
    unmount();
    act(() => onCurrentSync());
    expect(getTransaction).toHaveBeenCalledTimes(3);
  });
});
