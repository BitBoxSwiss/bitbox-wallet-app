// SPDX-License-Identifier: Apache-2.0

import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export const subscribeOnline = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('online', cb)
);
