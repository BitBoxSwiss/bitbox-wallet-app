// SPDX-License-Identifier: Apache-2.0

import { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { attestationCheckDone, verifyAttestation } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { AppContext } from '@/contexts/AppContext';
import { AppStateContext } from '@/contexts/app-state-context';
import { useSync } from '@/hooks/api';
import { SessionStatus } from '@/components/status/status-session';

const dismissalKey = (deviceID: string) => `attestation-warning-${deviceID}`;

type TDeviceProps = {
  deviceID: string;
};

const DeviceAttestationWarning = ({ deviceID }: TDeviceProps) => {
  const { t } = useTranslation();
  const attestation = useSync(
    () => verifyAttestation(deviceID),
    cb => attestationCheckDone(deviceID, () => {
      verifyAttestation(deviceID).then(cb);
    }),
  );

  if (attestation !== false) {
    return null;
  }

  return (
    <SessionStatus dismissibleKey={dismissalKey(deviceID)} type="warning">
      <div role="alert">{t('bitbox02Wizard.attestationFailed')}</div>
    </SessionStatus>
  );
};

type TProps = {
  devices: TDevices;
};

// Device state and transport must not determine whether a failed genuine check is shown.
export const AttestationWarnings = ({ devices }: TProps) => {
  const { updateSessionConfig } = useContext(AppContext);
  const appState = useContext(AppStateContext);
  // Suppress only the device whose non-dismissible warning is already visible.
  const excludeDeviceID = (
    appState?.mode === 'unlock' && appState.unlock?.attestation === false
      ? appState.unlock.deviceID
      : undefined
  );
  const previousDevices = useRef(devices);

  useEffect(() => {
    const disconnected = Object.keys(previousDevices.current).filter(deviceID => (
      previousDevices.current[deviceID] === 'bitbox02' && devices[deviceID] !== 'bitbox02'
    ));
    previousDevices.current = devices;
    // Each connection needs a fresh warning, even if its device ID is reused.
    if (disconnected.length > 0) {
      updateSessionConfig(Object.fromEntries(disconnected.map(deviceID => [dismissalKey(deviceID), false])));
    }
  }, [devices, updateSessionConfig]);

  return (
    <>
      {Object.entries(devices).map(([deviceID, platform]) => (
        platform === 'bitbox02' && deviceID !== excludeDeviceID
          ? <DeviceAttestationWarning key={deviceID} deviceID={deviceID} />
          : null
      ))}
    </>
  );
};
