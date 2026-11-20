// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';

export type TDeviceInfo = {
  bootlock: boolean;
  id: string;
  lock: boolean;
  name: string;
  seeded: boolean;
  serial: string;
  sdcard: boolean;
  TFA: string;
  U2F: boolean;
  U2F_hijack: boolean;
  version: string;
};

export const getDeviceInfo = (
  deviceID: string,
): Promise<TDeviceInfo | null> => {
  return apiGet(`devices/${deviceID}/info`);
};
