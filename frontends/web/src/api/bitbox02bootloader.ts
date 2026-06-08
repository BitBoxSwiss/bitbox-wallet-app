// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export type TStatus = {
  upgrading: boolean;
  errMsg?: string;
  progress: number;
  upgradeSuccessful: boolean;
};

export const getStatus = (
  deviceID: string,
): Promise<TStatus> => {
  return apiGet(`devices/bitbox02-bootloader/${deviceID}/status`);
};

export const syncStatus = (deviceID: string) => {
  return (
    cb: TSubscriptionCallback<TStatus>
  ) => {
    return subscribeEndpoint(`devices/bitbox02-bootloader/${deviceID}/status`, cb);
  };
};

type TProduct =
  'bitbox02-multi'
  | 'bitbox02-btconly'
  | 'bitbox02-plus-multi'
  | 'bitbox02-plus-btconly';

type TInfo = {
  product: TProduct;
  // Indicates whether the device has any firmware already installed on it.
  // It is considered "erased" if there's no firmware, and it also happens
  // to be the state in which BitBox02 is shipped to customers.
  erased: boolean;
  // Indicates whether the user can install/upgrade firmware.
  canUpgrade: boolean;
  // This is true if there is more than one upgrade to be performed (intermediate and final).
  additionalUpgradeFollows: boolean;
};

export const getInfo = (
  deviceID: string,
): Promise<TInfo> => {
  return apiGet(`devices/bitbox02-bootloader/${deviceID}/info`);
};

export const upgradeFirmware = (
  deviceID: string,
): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/upgrade-firmware`);
};

export const reboot = (
  deviceID: string,
): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/reboot`);
};

export const screenRotate = (
  deviceID: string,
): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/screen-rotate`);
};

export const getShowFirmwareHash = (deviceID: string) => {
  return (): Promise<boolean> => {
    return apiGet(`devices/bitbox02-bootloader/${deviceID}/show-firmware-hash-enabled`);
  };
};

export const setShowFirmwareHash = (
  deviceID: string,
  enabled: boolean,
) => {
  return apiPost(
    `devices/bitbox02-bootloader/${deviceID}/set-firmware-hash-enabled`,
    enabled,
  );
};
