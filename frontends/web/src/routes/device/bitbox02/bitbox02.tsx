// SPDX-License-Identifier: Apache-2.0

import { getStatus, statusChanged } from '@/api/bitbox02';
import { useSync } from '@/hooks/api';
import { BB02Settings } from '@/routes/settings/bb02-settings';

type TProps = {
  deviceID: string;
};

export const BitBox02 = ({ deviceID }: TProps) => {
  const status = useSync(
    () => getStatus(deviceID),
    cb => statusChanged(deviceID, cb)
  );
  if (status !== 'initialized') {
    return null;
  }
  return (
    <BB02Settings deviceID={deviceID} />
  );
};
