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
  connectionError?: string;
};

export type TState = {
  peripherals: TPeripheral[];
  connecting: boolean;
};

export const getState = (): Promise<TState> => {
  return apiGet('bluetooth/state');
};

export const connect = (identifier: string): Promise<void> => {
  return apiPost('bluetooth/connect', identifier);
};

export const syncState = (
  cb: (state: TState) => void
): TUnsubscribe => {
  return subscribeEndpoint('bluetooth/state', cb);
};
