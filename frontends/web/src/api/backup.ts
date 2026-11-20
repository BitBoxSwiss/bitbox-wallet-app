// SPDX-License-Identifier: Apache-2.0

import type { TFailResponse } from './response';
import { apiGet } from '@/utils/request';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type TBackup = {
  id: string;
  date: string;
  name: string;
};

type TBackupResponse = {
  success: true;
  backups: TBackup[];
};

export const getBackupList = (
  deviceID: string
): Promise<TBackupResponse | TFailResponse> => {
  return apiGet(`devices/bitbox02/${deviceID}/backups/list`);
};

export const subscribeBackupList = (deviceID: string) => (
  (cb: TSubscriptionCallback<TBackupResponse>) => (
    subscribeEndpoint(`devices/bitbox02/${deviceID}/backups/list`, cb)
  )
);