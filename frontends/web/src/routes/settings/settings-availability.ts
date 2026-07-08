// SPDX-License-Identifier: Apache-2.0

import type { DeviceInfo } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { debug, runningInAndroid, runningInIOS } from '@/utils/env';

type TTestWalletVisibilityArgs = {
  deviceIDs: string[];
  isTesting: boolean;
};

type TDeviceInfoWithBluetooth = DeviceInfo & {
  bluetooth: NonNullable<DeviceInfo['bluetooth']>;
};

export const isNotesSettingsVisible = (hasAccounts: boolean) => hasAccounts;

export const isDeviceSettingsVisible = (devices: TDevices) => Object.keys(devices).length > 0;

export const isDeviceBluetoothSupported = (
  deviceInfo?: DeviceInfo,
): deviceInfo is TDeviceInfoWithBluetooth => !!deviceInfo?.bluetooth;

export const isBluetoothToggleSettingVisible = (deviceInfo?: DeviceInfo) => (
  isDeviceBluetoothSupported(deviceInfo) && !runningInIOS()
);

export const isScreenLockSettingVisible = () => runningInAndroid() || runningInIOS();

export const isExportLogsSettingVisible = () => !debug;

export const isTestWalletSettingVisible = ({
  deviceIDs,
  isTesting,
}: TTestWalletVisibilityArgs) => isTesting && deviceIDs.length === 0;
