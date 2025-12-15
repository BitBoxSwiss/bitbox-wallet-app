// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';

type DarkModeContextProps = {
  isDarkMode: boolean;
  toggleDarkmode: (darkmode: boolean) => void;
};

export const DarkModeContext = createContext<DarkModeContextProps>({} as DarkModeContextProps);
