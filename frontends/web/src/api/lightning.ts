/**
 * Copyright 2021 Shift Crypto AG
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

import { apiGet } from '../utils/request';
import { AccountCode } from './account';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export interface ILightningStatus {
    pubkey: string;
    blockHeight: number;
    synced: boolean;
    localBalance: number;
    remoteBalance: number;
}

export const getStatus = (code: AccountCode): Promise<ILightningStatus> => {
  return apiGet(`account/${code}/lightning/status`);
};


/**
 * Subscriptions
 */

/**
 * Returns a function that subscribes a callback on a "account/<CODE>/lightning/status"
 * event to receive the latest state of the lightning node.
 * Meant to be used with `useSubscribe`.
 */
export const subscribeStatus = (code: string) => {
  return (
    cb: TSubscriptionCallback<ILightningStatus>
  ) => {
    return subscribeEndpoint(`account/${code}/lightning/status`, (
      nodeState: ILightningStatus,
    ) => {
      cb(nodeState);
    });
  };
};