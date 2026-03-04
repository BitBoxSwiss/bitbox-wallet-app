// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useConfig } from './ConfigProvider';
import { setDarkTheme, detectDarkTheme } from '@/api/darktheme';
import { runningInAndroid } from '@/utils/env';
import { useMediaQuery } from '@/hooks/mediaquery';
import { DarkModeContext } from './DarkmodeContext';

type TProps = {
  children: ReactNode;
};

export const DarkModeProvider = ({ children }: TProps) => {
  const { config, setConfig } = useConfig();
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
    if (config === undefined) {
      return;
    }
    if ('darkmode' in config.frontend) {
      setIsDarkMode(config.frontend.darkmode as boolean);
      return;
    }
    if (runningInAndroid()) {
      setIsDarkMode(androidPrefersDarkMode);
    } else {
      detectDarkTheme().then(setIsDarkMode);
    }
  }, [androidPrefersDarkMode, config]);

  useEffect(() => {
    setAppTheme();
  }, [isDarkMode, setAppTheme]);

  const toggleDarkmode = (darkmode: boolean) => {
    setIsDarkMode(darkmode);
    if (!config) {
      return;
    }
    (async () => {
      let preferredDarkMode;
      if (runningInAndroid()) {
        preferredDarkMode = androidPrefersDarkMode;
      } else {
        preferredDarkMode = await detectDarkTheme();
      }
      if (preferredDarkMode === darkmode) {
        // Remove darkmode from config, so it uses the same mode as the OS.
        const { darkmode: _, ...frontend } = config.frontend;
        setConfig({
          frontend: {
            ...frontend,
            darkmode: undefined,
          },
        });
      } else {
        setConfig({
          frontend: {
            ...config.frontend,
            darkmode,
          }
        });
      }
    })();
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkmode }}>
      {children}
    </DarkModeContext.Provider>
  );
};
