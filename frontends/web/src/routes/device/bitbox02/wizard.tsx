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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoad, useSync } from '@/hooks/api';
import { attestationCheckDone, getStatus, getVersion, verifyAttestation, statusChanged } from '@/api/bitbox02';
import { AppUpgradeRequired } from '@/components/appupgraderequired';
import { FirmwareUpgradeRequired } from '@/routes/device/upgrade-firmware-required';
import { Main } from '@/components/layout';
import { Unlock } from './unlock';
import { Pairing } from './setup/pairing';
import { SetupOptions, TWalletCreateOptions, TWalletSetupChoices } from './setup/choose';
import { CreateWallet } from './setup/wallet-create';
import { RestoreFromSDCard, RestoreFromMnemonic } from './setup/wallet-restore';
import { CreateWalletSuccess, RestoreFromMnemonicSuccess, RestoreFromSDCardSuccess } from './setup/success';

type TProps = {
  deviceID: string;
};

export const Wizard = ({ deviceID }: TProps) => {
  const navigate = useNavigate();
  const versionInfo = useLoad(() => getVersion(deviceID));
  const attestation = useSync(
    () => verifyAttestation(deviceID),
    cb => attestationCheckDone(deviceID, () => {
      verifyAttestation(deviceID).then(cb);
    })
  );
  const [setupChoice, setSetupChoice] = useState<'' | TWalletSetupChoices>('');
  const [createOptions, setCreateOptions] = useState<TWalletCreateOptions>();
  const [showWizard, setShowWizard] = useState<boolean>(false);
  // If true, we just pair and unlock, so we can hide some steps.
  const [unlockOnly, setUnlockOnly] = useState<boolean>(true);
  const status = useSync(
    () => getStatus(deviceID),
    cb => statusChanged(deviceID, cb)
  );
  const handleGetStarted = () => {
    setShowWizard(false);
    navigate('/account-summary?with-chart-animation=true');
  };

  useEffect(() => {
    if (status === undefined) {
      return;
    }
    if (!showWizard && ['connected', 'unpaired', 'pairingFailed', 'uninitialized', 'seeded'].includes(status)) {
      setShowWizard(true);
    }
    if (unlockOnly && ['uninitialized', 'seeded'].includes(status)) {
      setUnlockOnly(false);
    }
  }, [status, showWizard, unlockOnly]);

  const handleAbort = () => {
    setSetupChoice('');
    setCreateOptions(undefined);
  };
  if (status === undefined) {
    return null;
  }
  if (!versionInfo) {
    return null;
  }
  if (status === 'require_firmware_upgrade') {
    return (
      <FirmwareUpgradeRequired
        deviceID={deviceID}
        versionInfo={versionInfo} />
    );
  }
  if (status === 'require_app_upgrade') {
    return <AppUpgradeRequired/>;
  }
  if (!showWizard) {
    return null;
  }
  // fixes empty main element, happens when after unlocking the device, reason wizard is now always mounted in app.tsx
  if (setupChoice === '' && status === 'initialized') {
    return null;
  }
  return (
    <Main>
      { (status === 'connected') ? (
        <Unlock
          key="unlock"
          attestation={attestation} />
      ) : null }

      { (status === 'unpaired' || status === 'pairingFailed') && (
        <Pairing
          key="pairing"
          deviceID={deviceID}
          attestation={attestation}
          pairingFailed={status === 'pairingFailed'} />
      )}

      { (!unlockOnly && setupChoice === '') && (
        <SetupOptions
          key="choose-setup"
          versionInfo={versionInfo}
          onSelectSetup={(
            type: TWalletSetupChoices,
            createOptions?: TWalletCreateOptions,
          ) => {
            setSetupChoice(type);
            setCreateOptions(createOptions);
          }} />
      )}

      { (!unlockOnly && setupChoice === 'create-wallet') && (
        <CreateWallet
          backupType={(createOptions?.withMnemonic ? 'mnemonic' : 'sdcard')}
          backupSeedLength={createOptions?.with12Words ? 16 : 32}
          deviceID={deviceID}
          isSeeded={status === 'seeded'}
          onAbort={handleAbort} />
      )}

      {/* keeping the backups mounted even restoreBackupStatus === 'restore' is not true so it catches potential errors */}
      { (!unlockOnly && setupChoice === 'restore-sdcard' && status !== 'initialized') && (
        <RestoreFromSDCard
          key="restore-sdcard"
          deviceID={deviceID}
          onAbort={handleAbort} />
      )}

      { (!unlockOnly && setupChoice === 'restore-mnemonic' && status !== 'initialized') && (
        <RestoreFromMnemonic
          key="restore-mnemonic"
          deviceID={deviceID}
          onAbort={handleAbort} />
      )}

      { (setupChoice === 'create-wallet' && status === 'initialized') && (
        <CreateWalletSuccess
          key="success"
          backupType={(createOptions?.withMnemonic ? 'mnemonic' : 'sdcard')}
          onContinue={handleGetStarted} />
      )}
      { (setupChoice === 'restore-sdcard' && status === 'initialized') && (
        <RestoreFromSDCardSuccess key="backup-success" onContinue={handleGetStarted} />
      )}
      { (setupChoice === 'restore-mnemonic' && status === 'initialized') && (
        <RestoreFromMnemonicSuccess key="backup-mnemonic-success" onContinue={handleGetStarted} />
      )}
    </Main>
  );
};
