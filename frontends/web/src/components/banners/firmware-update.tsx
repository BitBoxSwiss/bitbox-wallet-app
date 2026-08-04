// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import type { TDevices } from '@/api/devices';
import { getVersion } from '@/api/bitbox02';
import { AppContext } from '@/contexts/AppContext';
import { SessionStatus } from '@/components/status/status-session';
import style from './banner.module.css';

type TProps = {
  devices: TDevices;
};

export const FirmwareUpdateBanner = ({ devices }: TProps) => {
  const { setFirmwareUpdateDialogOpen } = useContext(AppContext);
  const [upgradableDeviceID, setUpgradableDeviceID] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const checkUpgradableDevices = async () => {
      setUpgradableDeviceID(undefined);
      const bitbox02Devices = Object.keys(devices).filter(deviceID => devices[deviceID] === 'bitbox02');

      for (const deviceID of bitbox02Devices) {
        const { canUpgrade } = await getVersion(deviceID);
        if (cancelled) {
          return;
        }
        if (canUpgrade) {
          setUpgradableDeviceID(deviceID);
          // exit early as we found an upgradable device
          return;
        }
      }
    };

    checkUpgradableDevices();

    return () => {
      cancelled = true;
    };
  }, [devices]);

  if (!upgradableDeviceID) {
    return null;
  }
  return (
    <SessionStatus
      dismissibleKey="firmware-update-banner"
      type="warning">
      <Trans
        i18nKey="upgradeFirmware.banner"
        components={{
          updateLink: (
            <Link
              className={style.link}
              to={`/settings/device-settings/${upgradableDeviceID}`}
              onClick={() => setFirmwareUpdateDialogOpen(true)}
            />
          ),
        }}
      />
    </SessionStatus>
  );
};
