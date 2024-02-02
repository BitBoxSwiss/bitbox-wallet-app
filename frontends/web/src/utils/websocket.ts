/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { qtSubscribePushNotifications } from './transport-qt';
import { mobileSubscribePushNotifications } from './transport-mobile';
import { webSubscribePushNotifications } from './transport-websocket';
import { TPayload, TMsgCallback, TUnsubscribe } from './transport-common';
import { runningInQtWebEngine, runningOnMobile } from './env';

export type { TPayload, TUnsubscribe };

export function apiWebsocket(msgCallback: TMsgCallback): TUnsubscribe {
  if (runningInQtWebEngine()) {
    return qtSubscribePushNotifications(msgCallback);
  }
  if (runningOnMobile()) {
    return mobileSubscribePushNotifications(msgCallback);
  }
  return webSubscribePushNotifications(msgCallback);
}
