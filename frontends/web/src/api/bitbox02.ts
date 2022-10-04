/**
 * Copyright 2021 Shift Crypto AG
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

import { apiGet, apiPost } from '../utils/request';
import { SuccessResponse, FailResponse } from './response';

export type DeviceInfo = {
    initialized: boolean;
    mnemonicPassphraseEnabled: boolean;
    name: string;
    securechipModel: string;
    version: string;
}

type DeviceInfoResponse = SuccessResponse & {
    deviceInfo: DeviceInfo;
};

export const getDeviceInfo = (
  deviceID: string
): Promise<DeviceInfo> => {
  return apiGet(`devices/bitbox02/${deviceID}/info`)
    .then((response: DeviceInfoResponse | FailResponse) => {
      if (!response.success) {
        return Promise.reject(response);
      }
      return Promise.resolve(response.deviceInfo);
    });
};

export const checkSDCard = (
  deviceID: string,
): Promise<boolean> => {
  return apiGet(`devices/bitbox02/${deviceID}/check-sdcard`);
};

export const setDeviceName = (
  deviceID: string,
  newDeviceName: string,
): Promise<void> => {
  return apiPost(`devices/bitbox02/${deviceID}/set-device-name`, {
    name: newDeviceName
  })
    .then((response: SuccessResponse | FailResponse) => {
      if (!response.success) {
        return Promise.reject(response);
      }
      return Promise.resolve();
    });
};

export type VersionInfo = {
    newVersion: string;
    currentVersion: string;
    canUpgrade: boolean;
    canGotoStartupSettings: boolean;
}

export const getVersion = (
  deviceID: string
): Promise<VersionInfo> => {
  return apiGet(`devices/bitbox02/${deviceID}/version`);
};

export const setMnemonicPassphraseEnabled = (
  deviceID: string,
  enabled: boolean,
): Promise<void | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/set-mnemonic-passphrase-enabled`, enabled)
    .then((response: SuccessResponse | FailResponse) => {
      if (!response.success) {
        return Promise.reject(response);
      }
      return Promise.resolve();
    });
};

export const verifyAttestation = (
  deviceID: string,
): Promise<boolean> => {
  return apiGet(`devices/bitbox02/${deviceID}/attestation`);
};
