// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useAppState } from '@/contexts/app-state-context';

/**
 * Returns a key derived from the current devices.
 *
 * The key changes when the connected devices change, allowing components
 * that depend on the device list to be remounted when necessary.
 *
 * @param prefix - A prefix used to distinguish keys for different components.
 * @returns A key string representing the current devices.
 */
export const useDevicesKey = (prefix: string) => {
  const { devices } = useAppState();

  return useMemo(
    () => `${prefix}:${JSON.stringify(devices, Object.keys(devices).sort())}`,
    [prefix, devices],
  );
};
