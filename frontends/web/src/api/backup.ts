// SPDX-License-Identifier: Apache-2.0

import type { FailResponse } from './response';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type Backup = {
  id: string;
  date: string;
  name: string;
};

type BackupResponse = {
  success: true;
  backups: Backup[];
};

export const subscribeBackupList = (deviceID: string) => (
  (cb: TSubscriptionCallback<BackupResponse | FailResponse>) => (
    subscribeEndpoint(`devices/bitbox02/${deviceID}/backups/list`, cb)
  )
);
