// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { SettingsItem } from '../settingsItem/settingsItem';

export const DisableLightning = () => {
  // const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SettingsItem
      settingName="Disable lightning wallet"
      secondaryText="Lightning enables instant and low fee payments."
      onClick={() => navigate('/lightning/deactivate/')}
    />
  );
};
