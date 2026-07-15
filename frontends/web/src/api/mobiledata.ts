// SPDX-License-Identifier: Apache-2.0

import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export const subscribeUsingMobileData = (
  cb: TSubscriptionCallback<boolean>
) => (
  subscribeEndpoint('using-mobile-data', cb)
);
