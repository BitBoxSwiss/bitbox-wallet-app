// SPDX-License-Identifier: Apache-2.0

import { TDevices } from '@/api/devices';
import BitBox01 from './bitbox01/bitbox01';
import { BitBox02 } from './bitbox02/bitbox02';
import { BitBox02Bootloader } from '@/components/devices/bitbox02bootloader/bitbox02bootloader';
import { Waiting } from './waiting';

type TProps = {
  devices: TDevices;
  deviceID: string | null;
  hasAccounts: boolean;
};

const DeviceSwitch = ({ deviceID, devices, hasAccounts }: TProps) => {
  const deviceIDs = Object.keys(devices);

  if (deviceID === null || !deviceIDs.includes(deviceID)) {
    return <Waiting />;
  }

  switch (devices[deviceID]) {
  case 'bitbox':
    return <BitBox01 deviceID={deviceID} />;
  case 'bitbox02':
    return (
      <BitBox02
        deviceID={deviceID}
        devices={devices}
        hasAccounts={hasAccounts}
      />
    );
  case 'bitbox02-bootloader':
    return <BitBox02Bootloader deviceID={deviceID} />;
  default:
    return <Waiting />;
  }
};

export { DeviceSwitch };
