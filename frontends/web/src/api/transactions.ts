// SPDX-License-Identifier: Apache-2.0

import type { TUnsubscribe } from '@/utils/transport-common';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type TNewTxs = {
  count: number;
  accountName: string;
};

export const syncNewTxs = (cb: TSubscriptionCallback<TNewTxs>): TUnsubscribe => {
  return subscribeEndpoint('new-txs', cb);
};
