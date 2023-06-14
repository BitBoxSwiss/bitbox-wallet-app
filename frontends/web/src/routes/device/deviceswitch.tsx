/**
 * Copyright 2018 Shift Devices AG
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

import { TDevices } from '../../api/devices';
import BitBox01 from './bitbox01/bitbox01';
import { BitBox02 } from './bitbox02/bitbox02';
import { BitBox02Bootloader } from '../../components/devices/bitbox02bootloader/bitbox02bootloader';
import { Waiting } from './waiting';

type TProps = {
  devices: TDevices;
  deviceID: string | null;
  hasAccounts: boolean,
}

const DeviceSwitch = ({ deviceID, devices, hasAccounts }: TProps) => {
  const deviceIDs = Object.keys(devices);

  if (deviceID === null || !deviceIDs.includes(deviceID)) {
    return <Waiting />;
  }

  switch (devices[deviceID]) {
  case 'bitbox':
    return <BitBox01 deviceID={deviceID} />;
  case 'bitbox02':
    return <BitBox02
      deviceID={deviceID}
      deviceIDs={deviceIDs}
      hasAccounts={hasAccounts}
    />;
  case 'bitbox02-bootloader':
    return <BitBox02Bootloader deviceID={deviceID} />;
  default:
    return <Waiting />;
  }
};

export { DeviceSwitch };
