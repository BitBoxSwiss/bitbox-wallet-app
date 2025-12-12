// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { getConfig, setConfig } from '@/utils/config';
import { setDarkTheme, detectDarkTheme } from '@/api/darktheme';
import { runningInAndroid } from '@/utils/env';
import { useMediaQuery } from '@/hooks/mediaquery';
import { DarkModeContext } from './DarkmodeContext';

type TProps = {
  children: ReactNode;
};

export const DarkModeProvider = ({ children }: TProps) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const androidPrefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

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
        if (!!config.frontend && 'darkmode' in config.frontend) {
          setIsDarkMode(config.frontend.darkmode);
          return;
        }
        // else use mode from OS
        if (runningInAndroid()) {
          setIsDarkMode(androidPrefersDarkMode);
        } else {
          detectDarkTheme().then(setIsDarkMode);
        }
      })
      .catch(console.error);
  }, [androidPrefersDarkMode]);

  useEffect(() => {
    setAppTheme();
  }, [isDarkMode, setAppTheme]);

  const toggleDarkmode = (darkmode: boolean) => {
    setIsDarkMode(darkmode);
    getConfig()
      .then(async config => {
        let preferredDarkMode;
        if (runningInAndroid()) {
          preferredDarkMode = androidPrefersDarkMode;
        } else {
          preferredDarkMode = await detectDarkTheme();
        }
        if (preferredDarkMode === darkmode) {
          // remove darkmode from config, so it use the same mode as the OS
          const { darkmode, ...frontend } = config.frontend;
          setConfig({
            frontend: {
              ...frontend,
              darkmode: undefined,
            },
          });
        } else {
          // darkmode is different from OS, save to config
          setConfig({
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
