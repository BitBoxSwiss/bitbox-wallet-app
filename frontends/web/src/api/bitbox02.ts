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
import { TSuccess, TFail } from './response';

export type TDeviceInfo = {
    initialized: boolean;
    mnemonicPassphraseEnabled: boolean;
    name: string;
    securechipModel: string;
    version: string;
}

interface IDeviceInfo extends TSuccess {
    deviceInfo: TDeviceInfo;
}

export const getDeviceInfo = (
    deviceID: string
): Promise<IDeviceInfo | TFail> => {
    return apiGet(`devices/bitbox02/${deviceID}/info`);
};

export const setMnemonicPassphraseEnabled = (
    deviceID: string,
    enabled: boolean,
): Promise<TSuccess | TFail> => {
    return apiPost(`devices/bitbox02/${deviceID}/set-mnemonic-passphrase-enabled`, enabled);
};
