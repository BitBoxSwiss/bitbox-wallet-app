/**
 * Copyright 2025 Shift Crypto AG
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

import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, TUnsubscribe } from './subscribe';

export type TPeripheral = {
  identifier: string;
  name: string;
} & (
  | {
      connectionState: 'discovered' | 'connecting' | 'connected';
    }
  | {
      connectionState: 'error';
      connectionError: string;
    }
);

type TBluetoothState = {
  bluetoothAvailable: boolean;
  scanning: boolean;
  peripherals: TPeripheral[];
};

export const getState = (): Promise<TBluetoothState> => {
  return apiGet('bluetooth/state');
};

export const connect = (identifier: string): Promise<void> => {
  return apiPost('bluetooth/connect', identifier);
};

export const syncState = (
  cb: (state: TBluetoothState) => void,
): TUnsubscribe => {
  return subscribeEndpoint('bluetooth/state', cb);
};
