/**
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

import { apiGet, apiPost } from '@/utils/request';
import { subscribeEndpoint, TSubscriptionCallback } from './subscribe';

export type TStatus = {
  upgrading: boolean;
  errMsg?: string;
  progress: number;
  upgradeSuccessful: boolean;
};

export const getStatus = (deviceID: string): Promise<TStatus> => {
  return apiGet(`devices/bitbox02-bootloader/${deviceID}/status`);
};

export const syncStatus = (deviceID: string) => {
  return (cb: TSubscriptionCallback<TStatus>) => {
    return subscribeEndpoint(
      `devices/bitbox02-bootloader/${deviceID}/status`,
      cb,
    );
  };
};

export type TVersionInfo = {
  // Indicates whether the device has any firmware already installed on it.
  // It is considered "erased" if there's no firmware, and it also happens
  // to be the state in which BitBox02 is shipped to customers.
  erased: boolean;
  // Indicates whether the user can install/upgrade firmware.
  canUpgrade: boolean;
  // This is true if there is more than one upgrade to be performed (intermediate and final).
  additionalUpgradeFollows: boolean;
};

export const getVersionInfo = (deviceID: string): Promise<TVersionInfo> => {
  return apiGet(`devices/bitbox02-bootloader/${deviceID}/version-info`);
};

export const upgradeFirmware = (deviceID: string): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/upgrade-firmware`);
};

export const reboot = (deviceID: string): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/reboot`);
};

export const screenRotate = (deviceID: string): Promise<void> => {
  return apiPost(`devices/bitbox02-bootloader/${deviceID}/screen-rotate`);
};

export const getShowFirmwareHash = (deviceID: string) => {
  return (): Promise<boolean> => {
    return apiGet(
      `devices/bitbox02-bootloader/${deviceID}/show-firmware-hash-enabled`,
    );
  };
};

export const setShowFirmwareHash = (deviceID: string, enabled: boolean) => {
  return apiPost(
    `devices/bitbox02-bootloader/${deviceID}/set-firmware-hash-enabled`,
    enabled,
  );
};
