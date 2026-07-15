// SPDX-License-Identifier: Apache-2.0

import { statusChanged } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { useSubscribe } from '@/hooks/api';
import { BB02Settings } from '@/routes/settings/bb02-settings';

type TProps = {
  deviceID: string;
  devices: TDevices;
  hasAccounts: boolean;
};

export const BitBox02 = ({ deviceID, devices, hasAccounts }: TProps) => {
  const status = useSubscribe(cb => statusChanged(deviceID, cb));
  if (status !== 'initialized') {
    return null;
  }
  return <BB02Settings deviceID={deviceID} devices={devices} hasAccounts={hasAccounts} />;
};
