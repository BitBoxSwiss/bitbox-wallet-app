/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { getStatus, statusChanged } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { useSync } from '@/hooks/api';
import { BB02Settings } from '@/routes/settings/bb02-settings';

type TProps = {
  deviceID: string;
  devices: TDevices;
  hasAccounts: boolean;
};

export const BitBox02 = ({ deviceID, devices, hasAccounts }: TProps) => {
  const status = useSync(
    () => getStatus(deviceID),
    cb => statusChanged(deviceID, cb)
  );
  if (status !== 'initialized') {
    return null;
  }
  return <BB02Settings deviceID={deviceID} devices={devices} hasAccounts={hasAccounts} />;
};
