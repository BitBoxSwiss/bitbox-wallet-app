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
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Checked, WarningOLD } from '@/components/icon';
import { verifyAttestation } from '@/api/bitbox02';
import { StyledSkeleton } from '@/routes/settings/bb02-settings';

type TProps = {
  deviceID: string;
};

const AttestationCheckSetting = ({ deviceID }: TProps) => {
  const [attestation, setAttestation] = useState<boolean | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    verifyAttestation(deviceID).then(setAttestation);
  }, [deviceID]);

  const icon = attestation ? (
    <Checked />
  ) : (
    <WarningOLD width={20} height={20} />
  );

  if (attestation === null) {
    return <StyledSkeleton />;
  }

  return (
    <SettingsItem
      settingName={t('deviceSettings.hardware.attestation.label')}
      secondaryText={t(
        'deviceSettings.deviceInformation.attestation.description',
      )}
      extraComponent={icon}
      displayedValue={t(
        `deviceSettings.hardware.attestation.${attestation ? 'true' : 'false'}`,
      )}
      hideDisplayedValueOnSmall
    />
  );
};

export { AttestationCheckSetting };
