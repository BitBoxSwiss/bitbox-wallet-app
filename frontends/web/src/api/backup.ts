/**
 * Copyright 2023-2025 Shift Crypto AG
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

import type { FailResponse } from './response';
import { apiGet } from '@/utils/request';
import { TSubscriptionCallback, subscribeEndpoint } from './subscribe';

export type Backup = {
  id: string;
  date: string;
  name: string;
};

type BackupResponse = {
  success: true;
  backups: Backup[];
}

export const getBackupList = (
  deviceID: string
): Promise<BackupResponse | FailResponse> => {
  return apiGet(`devices/bitbox02/${deviceID}/backups/list`);
};

export const subscribeBackupList = (deviceID: string) => (
  (cb: TSubscriptionCallback<BackupResponse>) => (
    subscribeEndpoint(`devices/bitbox02/${deviceID}/backups/list`, cb)
  )
);