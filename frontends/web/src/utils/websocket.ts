// SPDX-License-Identifier: Apache-2.0

import { qtSubscribePushNotifications } from './transport-qt';
import { mobileSubscribePushNotifications } from './transport-mobile';
import { webSubscribePushNotifications } from './transport-websocket';
import { TPayload, TMsgCallback, TUnsubscribe } from './transport-common';
import { runningInQtWebEngine, runningOnMobile } from './env';

export type { TPayload, TUnsubscribe };

export const apiWebsocket = (msgCallback: TMsgCallback): TUnsubscribe => {
  if (runningInQtWebEngine()) {
    return qtSubscribePushNotifications(msgCallback);
  }
  if (runningOnMobile()) {
    return mobileSubscribePushNotifications(msgCallback);
  }
  return webSubscribePushNotifications(msgCallback);
};
