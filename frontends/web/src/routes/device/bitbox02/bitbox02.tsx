// SPDX-License-Identifier: Apache-2.0

import { getStatus, statusChanged } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { useSync } from '@/hooks/api';
import { BB02BackupSettings, BB02Settings } from '@/routes/settings/bb02-settings';

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

export const BitBox02Backup = ({ deviceID, devices, hasAccounts }: TProps) => {
  const isBitBox02 = devices[deviceID] === 'bitbox02';
  const status = useSync(
    isBitBox02 ? () => getStatus(deviceID) : async () => 'connected' as const,
    isBitBox02 ? cb => statusChanged(deviceID, cb) : () => () => undefined
  );
  if (!isBitBox02 || status !== 'initialized') {
    return null;
  }
  return <BB02BackupSettings deviceID={deviceID} devices={devices} hasAccounts={hasAccounts} />;
};
