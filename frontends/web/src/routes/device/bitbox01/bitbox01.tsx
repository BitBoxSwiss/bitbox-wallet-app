/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2025 Shift Crypto AG
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

import { useState, useEffect, useCallback } from 'react';
import { AppUpgradeRequired } from '@/components/appupgraderequired';
import { apiGet } from '@/utils/request';
import { apiWebsocket } from '@/utils/websocket';
import { Unlock } from './unlock';
import Bootloader from './upgrade/bootloader';
import RequireUpgrade from './upgrade/require_upgrade';
import Goal from './setup/goal';
import { SecurityInformation } from './setup/security-information';
import { SeedCreateNew } from './setup/seed-create-new';
import SeedRestore from './setup/seed-restore';
import { Initialize } from './setup/initialize';
import Success from './setup/success';
import Settings from './settings/settings';

const DeviceStatus = Object.freeze({
  BOOTLOADER: 'bootloader',
  INITIALIZED: 'initialized',
  UNINITIALIZED: 'uninitialized',
  LOGGED_IN: 'logged_in',
  SEEDED: 'seeded',
  REQUIRE_FIRMWARE_UPGRADE: 'require_firmware_upgrade',
  REQUIRE_APP_UPGRADE: 'require_app_upgrade',
});

const GOAL = Object.freeze({
  CREATE: 'create',
  RESTORE: 'restore',
});

type DeviceStatusType = (typeof DeviceStatus)[keyof typeof DeviceStatus];
type GoalType = (typeof GOAL)[keyof typeof GOAL];

type Props = {
  deviceID: string;
}

export const BitBox01 = ({ deviceID }: Props) => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusType | ''>('');
  const [goal, setGoal] = useState<GoalType | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);

  // --- Fetch device status ---
  const onDeviceStatusChanged = useCallback(() => {
    apiGet(`devices/${deviceID}/status`).then((status: DeviceStatusType) => {
      setDeviceStatus(status);
    });
  }, [deviceID]);

  useEffect(() => {
    onDeviceStatusChanged();
    const unsubscribe = apiWebsocket((data) => {
      if (
        'type' in data // check if TEventLegacy
        && data.type === 'device'
        && 'data' in data
        && data.data === 'statusChanged'
        && data.deviceID === deviceID) {
        onDeviceStatusChanged();
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [deviceID, onDeviceStatusChanged]);

  const handleCreate = () => setGoal(GOAL.CREATE);
  const handleRestore = () => setGoal(GOAL.RESTORE);
  const handleBack = () => setGoal(null);
  const handleSuccess = () => setSuccess(true);
  const handleHideSuccess = () => setSuccess(null);

  if (!deviceStatus) {
    return null;
  }

  if (success) {
    return (
      <Success goal={goal} handleHideSuccess={handleHideSuccess} />
    );
  }

  switch (deviceStatus) {
  case DeviceStatus.BOOTLOADER:
    return (
      <Bootloader deviceID={deviceID} />
    );
  case DeviceStatus.REQUIRE_FIRMWARE_UPGRADE:
    return (
      <RequireUpgrade deviceID={deviceID} />
    );
  case DeviceStatus.REQUIRE_APP_UPGRADE:
    return (
      <AppUpgradeRequired />
    );
  case DeviceStatus.INITIALIZED:
    return (
      <Unlock deviceID={deviceID} />
    );
  case DeviceStatus.UNINITIALIZED:
    if (!goal) {
      return (
        <Goal onCreate={handleCreate} onRestore={handleRestore} />
      );
    }
    return (
      <SecurityInformation goal={goal} goBack={handleBack}>
        <Initialize goBack={handleBack} deviceID={deviceID} />
      </SecurityInformation>
    );
  case DeviceStatus.LOGGED_IN:
    switch (goal) {
    case GOAL.CREATE:
      return (
        <SeedCreateNew
          goBack={handleBack}
          onSuccess={handleSuccess}
          deviceID={deviceID}
        />
      );
    case GOAL.RESTORE:
      return (
        <SeedRestore
          goBack={handleBack}
          onSuccess={handleSuccess}
          deviceID={deviceID}
        />
      );
    default:
      return (
        <Goal onCreate={handleCreate} onRestore={handleRestore} />
      );
    }
  case DeviceStatus.SEEDED:
    return (
      <Settings deviceID={deviceID} />
    );
  default:
    return null;
  }
};
