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

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { getConfig, setConfig } from '../api/backend';
import { setDarkTheme } from '../api/darktheme';
import { useMediaQuery } from '../hooks/mediaquery';
import DarkModeContext from './DarkmodeContext';

type TProps = {
  children: ReactNode;
}

export const DarkModeProvider = ({ children }: TProps) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const osPrefersDarkmode = useMediaQuery('(prefers-color-scheme: dark)');

  const setAppTheme = useCallback(() => {
    setDarkTheme(isDarkMode);
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  useEffect(() => {
    getConfig()
      .then(config => {
        // use config if it exists
        if ('darkmode' in config.frontend) {
          setIsDarkMode(config.frontend.darkmode);
          return;
        }
        // else use mode from OS
        setIsDarkMode(osPrefersDarkmode);

      })
      .catch(console.error);
  }, [osPrefersDarkmode]);

  useEffect(() => {
    setAppTheme();
  }, [isDarkMode, setAppTheme]);

  const toggleDarkmode = (darkmode: boolean) => {
    setIsDarkMode(!isDarkMode);
    getConfig()
      .then(config => {
        if (osPrefersDarkmode === darkmode) {
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
              darkmode,
            }
          });
        }
      });
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkmode }}>
      {children}
    </DarkModeContext.Provider>
  );
};


