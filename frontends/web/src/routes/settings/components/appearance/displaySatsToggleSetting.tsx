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
import { Toggle } from '../../../../components/toggle/toggle';
import { SettingsItem } from '../settingsItem/settingsItem';
import { useLoad } from '../../../../hooks/api';
import { getConfig, setConfig } from '../../../../utils/config';
import { RatesContext } from '../../../../contexts/RatesContext';
import { BtcUnit, setBtcUnit } from '../../../../api/coins';
import { alertUser } from '../../../../components/alert/Alert';

export const DisplaySatsToggleSetting = () => {
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig);
  const [displayAsSAT, setDisplayAsSAT] = useState<boolean>();

  const { updateRatesConfig } = useContext(RatesContext);

  useEffect(() => {
    if (fetchedConfig) {
      setDisplayAsSAT(fetchedConfig.backend.btcUnit === 'sat');
    }
  }, [fetchedConfig]);

  const handleToggleSatsUnit = async () => {
    const toggleDdisplayAsSAT = !displayAsSAT;
    const unit: BtcUnit = toggleDdisplayAsSAT ? 'sat' : 'default';
    setDisplayAsSAT(toggleDdisplayAsSAT);

    await setConfig({
      backend: { btcUnit: unit }
    });

    updateRatesConfig();

    const result = await setBtcUnit(unit);

    if (!result.success) {
      alertUser(t('genericError'));
    }
  };

  return (
    <>
      <SettingsItem
        settingName={t('settings.expert.useSats')}
        secondaryText={t('newSettings.appearance.toggleSats.description')}
        extraComponent={
          <>
            {
              displayAsSAT !== undefined ?
                (
                  <Toggle
                    checked={displayAsSAT}
                    onChange={handleToggleSatsUnit}
                  />
                ) :
                null
            }
          </>
        }
      />
    </>
  );
};