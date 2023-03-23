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
import { useLoad } from '../../hooks/api';
import { useMediaQuery } from '../../hooks/mediaquery';
import { getConfig, setConfig } from '../../api/backend';
import { SettingsToggle } from '../../components/settingsButton/settingsToggle';
import { setDarkmode as setGlobalDarkmode } from './darkmode';

export const DarkModeToggle = () => {
  const [darkmode, setDarkmode] = useState(false);
  const { t } = useTranslation();
  const config = useLoad(getConfig);
  const osPrefersDarkmode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    getConfig()
      .then(config => {
        // use config if it exists
        if ('darkmode' in config.frontend) {
          setDarkmode(config.frontend.darkmode);
          return;
        }
        // else use mode from OS
        setDarkmode(osPrefersDarkmode);
      })
      .catch(console.error);
  }, [config, osPrefersDarkmode]);

  useEffect(() => setGlobalDarkmode(darkmode), [darkmode]);

  const handleDarkmodeChange = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    setDarkmode(target.checked);
    getConfig()
      .then(config => {
        if (osPrefersDarkmode === target.checked) {
          // remove darkmode from config, so it use the same mode as the OS
          const { darkmode, ...frontend } = config.frontend;
          setConfig({
            backend: config.backend,
            frontend,
          });
        } else {
          // darkmode is different from OS, save to config
          setConfig({
            backend: config.backend,
            frontend: {
              ...config.frontend,
              darkmode: target.checked,
            }
          });
        }
      })
      .catch(console.error);
  };

  return (
    <SettingsToggle
      checked={darkmode}
      id="darkMode"
      onChange={handleDarkmodeChange}>
      {t('darkmode.toggle')}
    </SettingsToggle>
  );
};
