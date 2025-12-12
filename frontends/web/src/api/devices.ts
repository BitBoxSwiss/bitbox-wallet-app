// SPDX-License-Identifier: Apache-2.0

import { apiGet } from '@/utils/request';

export type TPlatformName = 'bitbox' | 'bitbox02' | 'bitbox02-bootloader';

export type TDevices = {
  readonly [key in string]: TPlatformName;
};

export const getDeviceList = (): Promise<TDevices> => {
  return apiGet('devices/registered');
};
