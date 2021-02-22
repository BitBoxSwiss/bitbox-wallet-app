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


type Success = {
    success: true;
}

// if the backend uses maybeBB02Err
type Fail = {
    code?: number;
    message?: string;
    success: false;
}


type Devices = {
    readonly [key in string]: 'bitbox01' | 'bitbox02';
};

export const getDeviceList = (): Promise<Devices> => {
    return apiGet('devices/registered');
};

// doesn't return { success: true } so this interface can't `extends Success`
export interface IDeviceInfo {
    initialized: boolean;
    mnemonicPassphraseEnabled: boolean;
    name: string;
    version: string;
}

export const getDeviceInfo = (
    deviceID: string
): Promise<IDeviceInfo | Fail> => {
    return apiGet(`devices/bitbox02/${deviceID}/info`);
};
/* Example
getDeviceInfo('deviceId').then(data => {
    if ('success' in data) {
        // fail as data.success = false
    } else {
        // success but data.success is missing
    }
})
*/

export interface IDeviceInfoBB01 {
    bootlock: boolean;
    id: string;
    lock: boolean;
    name: string;
    new_hidden_wallet: boolean; // eslint-disable-line camelcase
    pairing: boolean;
    sdcard: boolean;
    seeded: boolean;
    serial: string;
    TFA: string;
    U2F: boolean;
    U2F_hijack: boolean; // eslint-disable-line camelcase
    version: string;
}

export const getDeviceInfoBB01 = (deviceID: string): Promise<IDeviceInfoBB01> => {
    return apiGet(`devices/${deviceID}/info`);
};


export const setDeviceName = (
    deviceID: string,
    name: string,
): Promise<Success | Fail> => {
    return apiPost(`devices/${deviceID}/set-device-name`, { name });
};


type Status = 'connected'
    | 'unpaired' | 'pairingFailed'
    | 'uninitialized' | 'seeded' | 'initialized'
    | 'require_firmware_upgrade' | 'require_app_upgrade';

export const getStatus = (deviceID: string): Promise<Status> => {
    return apiGet(`devices/${deviceID}/status`);
};


type StatusBB01 = 'unpaired' | 'pairingFailed'
    | 'uninitialized' | 'seeded' | 'initialized'
    | 'require_firmware_upgrade' | 'require_app_upgrade';

export const getStatusBB01 = (deviceID: string): Promise<StatusBB01> => {
    return apiGet(`devices/${deviceID}/status`);
};

export interface IBundledFirmwareVersion {
    canUpgrade: boolean;
    currentVersion: string;
    newVersion: string;
}

export const getBundledFirmwareVersion = (
    deviceID: string
): Promise<IBundledFirmwareVersion> => {
    return apiGet(`devices/bitbox02/${deviceID}/bundled-firmware-version`);
};

export const getBundledFirmwareVersionBB01 = (deviceID: string): Promise<string> => {
    return apiGet(`devices/${deviceID}/bundled-firmware-version`);
};


export const upgradeFirmware = (deviceID: string): Promise<null | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/upgrade-firmware`);
};


export const checkSDCard = (deviceID: string): Promise<boolean | Fail> => {
    return apiGet(`devices/bitbox02/${deviceID}/check-sdcard`);
};


export const hasAttestation = (deviceID: string): Promise<boolean | null> => {
    return apiGet(`devices/bitbox02/${deviceID}/attestation`);
};


export interface IChannelHash {
    deviceVerified: boolean;
    hash: string;
}

export const getChannelHash = (deviceID: string): Promise<IChannelHash> => {
    return apiGet(`devices/bitbox02/${deviceID}/channel-hash`);
};

export const verifyChannelHash = (deviceID: string): Promise<null> => {
    return apiPost(`devices/bitbox02/${deviceID}/channel-hash-verify`, true);
};


export interface IBackup {
    date: string;
    id: string;
    name: string;
}

export interface IBackupList extends Success {
    backups: IBackup[];
}

export const getBackupList = (deviceID: string): Promise<IBackupList | Fail> => {
    return apiGet(`devices/bitbox02/${deviceID}/backups/list`);
};

export interface IBackupListBB01 extends Success {
    backupList: IBackup[];
    sdCardInserted: boolean;
}

export const getBackupListBB01 = (
    deviceID: string
): Promise<IBackupListBB01 | Fail> => {
    return apiGet(`devices/${deviceID}/backups/list`);
};

export const createBackup = (deviceID: string): Promise<Success | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/backups/create`);
};

export interface ICreateBackupResultBB01 extends Success {
    verification: boolean;
}

export const createBackupBB01 = (
    deviceID: string,
    options: {
        backupName: string;
        recoveryPassword: string;
    },
): Promise<ICreateBackupResultBB01 | Fail> => {
    return apiPost(`devices/${deviceID}/backups/create`, options);
};

interface ICheckBackupSuccess extends Success {
    backupID: string;
}

export const checkBackup = (
    deviceID: string,
    options: { silent: boolean },
): Promise<ICheckBackupSuccess | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/backups/check`, options);
};

interface ICheckBackupSuccessBB01 extends Success {
    matches: boolean;
}

export const checkBackupBB01 = (
    deviceID: string,
    options: {
        password: string;
        filename: string;
    },
): Promise<ICheckBackupSuccessBB01 | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/backups/check`, options);
};


export const restoreBackup = (
    deviceID: string,
    backupID: string,
): Promise<Success | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/backups/restore`, backupID);
};

export interface IRestoreSuccessBB01 extends Success {
    didRestore: boolean;
}

export const restoreBackupBB01 = (
    deviceID: string,
    options: {
        filename: string;
        password: string;
    },
): Promise<IRestoreSuccessBB01 | Fail> => {
    return apiPost(`devices/${deviceID}/backups/restore`, options);
};


export const restoreFromMnemonic = (deviceID: string): Promise<Success | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/restore-from-mnemonic`);
};


export const hasMobileChannel = (deviceID: string): Promise<boolean> => {
    return apiGet(`devices/${deviceID}/has-mobile-channel`);
};


export const setPassword = (deviceID: string): Promise<Success | Fail> => {
    return apiPost(`devices/bitbox02/${deviceID}/set-password`);
};

export const setPasswordBB01 = (
    deviceID: string,
    password: string,
): Promise<Success | Fail> => {
    return apiPost(`devices/${deviceID}/set-password`, { password });
};
