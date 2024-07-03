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

import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { useLoad } from '@/hooks/api';
import { getConfig, setConfig } from '@/utils/config';
import { AppContext } from '@/contexts/AppContext';

export const HideAmountsSetting = () => {
  const { t } = useTranslation();
  const { setHideAmounts } = useContext(AppContext);
  const [allowHideAmounts, setAllowHideAmounts] = useState<boolean>();
  const config = useLoad(getConfig);

  useEffect(() => {
    if (config) {
      if (config.frontend.allowHideAmounts === undefined) {
        setAllowHideAmounts(false);
        return;
      }
      setAllowHideAmounts(config.frontend.allowHideAmounts);
    }
  }, [config]);

  const toggleAllowHideAmounts = async () => {
    if (allowHideAmounts) {
      setHideAmounts(false);
      await setConfig({
        frontend: { hideAmounts: false }
      });
    }
    setAllowHideAmounts(!allowHideAmounts);
    await setConfig({
      frontend: { allowHideAmounts: !allowHideAmounts }
    });
  };

  return (
    <SettingsItem
      settingName={t('newSettings.appearance.hideAmounts.title')}
      secondaryText={t('newSettings.appearance.hideAmounts.description')}
      extraComponent={
        <>
          {
            allowHideAmounts !== undefined ?
              (
                <Toggle
                  checked={allowHideAmounts}
                  onChange={toggleAllowHideAmounts}
                />
              ) :
              null
          }
        </>
      }
    />
  );
};