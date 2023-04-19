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

import { apiGet, apiPost } from '../utils/request';
import { SuccessResponse, FailResponse } from './response';

// BitBox02 error codes.
export const errUserAbort = 104;

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

export const resetDevice = (deviceID: string): Promise<SuccessResponse | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/reset`);
};

export const getDeviceInfo = (
  deviceID: string,
): Promise<DeviceInfoResponse | FailResponse> => {
  return apiGet(`devices/bitbox02/${deviceID}/info`);
};

export const checkSDCard = (
  deviceID: string,
): Promise<boolean> => {
  return apiGet(`devices/bitbox02/${deviceID}/check-sdcard`);
};

export const insertSDCard = (
  deviceID: string,
): Promise<SuccessResponse | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/insert-sdcard`);
};

export const setDeviceName = (
  deviceID: string,
  newDeviceName: string,
): Promise<SuccessResponse | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/set-device-name`, {
    name: newDeviceName
  });
};

export type VersionInfo = {
    newVersion: string;
    currentVersion: string;
    canUpgrade: boolean;
    canGotoStartupSettings: boolean;
    // If true, creating a backup using the mnemonic recovery words instead of the microSD card
    // is supported in the initial setup.
    //
    // If false, the backup must be performed using the microSD card in the initial setup.
    //
    // This has no influence over whether one can display the recovery words after the initial
    // setup - that is always possible regardless of this value.
    canBackupWithRecoveryWords: boolean;
}

export const getVersion = (
  deviceID: string
): Promise<VersionInfo> => {
  return apiGet(`devices/bitbox02/${deviceID}/version`);
};

export const setMnemonicPassphraseEnabled = (
  deviceID: string,
  enabled: boolean,
): Promise<SuccessResponse | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/set-mnemonic-passphrase-enabled`, enabled);
};

export const verifyAttestation = (
  deviceID: string,
): Promise<boolean | null> => {
  return apiGet(`devices/bitbox02/${deviceID}/attestation`);
};

export const checkBackup = (
  deviceID: string,
  silent: boolean,
): Promise<FailResponse | (SuccessResponse & { backupID: string; })> => {
  return apiPost(`devices/bitbox02/${deviceID}/backups/check`, { silent });
};

// The 'recovery-words' method is only allowed if `canBackupWithRecoveryWords` returned by
// `getVersion()` is true.
export const createBackup = (
  deviceID: string,
  method: 'sdcard' | 'recovery-words',
): Promise<FailResponse | SuccessResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/backups/create`, method);
};

export const restoreBackup = (
  deviceID: string,
  selectedBackup: string,
): Promise<FailResponse | SuccessResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/backups/restore`, selectedBackup);
};

export const upgradeDeviceFirmware = (deviceID: string): Promise<void> => {
  return apiPost(`devices/bitbox02/${deviceID}/upgrade-firmware`);
};

export const showMnemonic = (deviceID: string): Promise<void> => {
  return apiPost(`devices/bitbox02/${deviceID}/show-mnemonic`);
};

export const restoreFromMnemonic = (
  deviceID: string,
): Promise<FailResponse | SuccessResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/restore-from-mnemonic`);
};

export type TStatus = 'connected'
  | 'initialized'
  | 'pairingFailed'
  | 'require_firmware_upgrade'
  | 'require_app_upgrade'
  | 'seeded'
  | 'unpaired'
  | 'uninitialized';

export const getStatus = (deviceID: string): Promise<TStatus> => {
  return apiGet(`devices/bitbox02/${deviceID}/status`);
};

type TChannelHash = {
  hash: string;
  deviceVerified: boolean;
};

export const getChannelHash = (deviceID: string): Promise<TChannelHash> => {
  return apiGet(`devices/bitbox02/${deviceID}/channel-hash`);
};

export const verifyChannelHash = (
  deviceID: string,
  ok: boolean,
): Promise<void> => {
  return apiPost(`devices/bitbox02/${deviceID}/channel-hash-verify`, ok);
};

export const setPassword = (
  deviceID: string,
): Promise<SuccessResponse | FailResponse> => {
  return apiPost(`devices/bitbox02/${deviceID}/set-password`);
};
