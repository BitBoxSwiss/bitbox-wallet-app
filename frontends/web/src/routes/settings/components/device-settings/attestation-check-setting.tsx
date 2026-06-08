// SPDX-License-Identifier: Apache-2.0

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

  const icon = attestation ? <Checked /> : <WarningOLD width={20} height={20} />;

  if (attestation === null) {
    return <StyledSkeleton />;
  }

  return (
    <SettingsItem
      settingName={t('deviceSettings.hardware.attestation.label')}
      secondaryText={t('deviceSettings.deviceInformation.attestation.description')}
      extraComponent={icon}
      displayedValue={t(`deviceSettings.hardware.attestation.${attestation ? 'true' : 'false'}`)}
      hideDisplayedValueOnSmall
    />
  );
};

export { AttestationCheckSetting };