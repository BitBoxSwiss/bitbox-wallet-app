/**
 * Copyright 2023 Shift Devices AG
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

import { useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Checked, RedDot } from '../../../../components/icon';

type TProps = {
    attestation: boolean;
}

const AttestationCheckSetting = ({ attestation }: TProps) => {
  const { t } = useTranslation();
  const icon = attestation ? <Checked /> : <RedDot width={20} height={20} />;
  return (
    <SettingsItem
      settingName={t('deviceSettings.hardware.attestation.label')}
      secondaryText={t('deviceSettings.deviceInformation.attestation.description')}
      extraComponent={icon}
      displayedValue={t(`deviceSettings.hardware.attestation.${attestation}`)}
    />
  );
};

export { AttestationCheckSetting };