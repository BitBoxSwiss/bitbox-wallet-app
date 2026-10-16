// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { WarningOLD } from '@/components/icon';

type TProps = {
  deviceID: string;
  canBIP85: boolean;
};

export const Bip85Setting = ({ canBIP85, deviceID }: TProps) => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  if (!canBIP85) {
    return (
      <SettingsItem
        settingName={t('deviceSettings.expert.bip85.title')}
        secondaryText={t('deviceSettings.expert.bip85.description')}
        extraComponent={<WarningOLD width={20} height={20} />}
        displayedValue={t('bitbox02Wizard.advanced.outOfDate')}
      />
    );
  }
  return (
    <SettingsItem
      onClick={() => navigate(`/settings/device-settings/bip85/${deviceID}`)}
      settingName={t('deviceSettings.expert.bip85.title')}
      secondaryText={t('deviceSettings.expert.bip85.description')}
    />
  );
};
