// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, TUnsubscribe } from './subscribe';

export type TPeripheral = {
  identifier: string;
  name: string;
} & (
  {
    connectionState: 'discovered' | 'connecting' | 'connected';
  } | {
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
  cb: (state: TBluetoothState) => void
): TUnsubscribe => {
  return subscribeEndpoint('bluetooth/state', cb);
};
