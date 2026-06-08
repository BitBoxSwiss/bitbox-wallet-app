// SPDX-License-Identifier: Apache-2.0

import { Dispatch, SetStateAction, createContext } from 'react';

export type TChartDisplay = 'week' | 'month' | 'year' | 'all';

export type TSessionConfig = {
  [key: string]: boolean;
};

type AppContextProps = {
  activeSidebar: boolean;
  guideShown: boolean;
  guideExists: boolean;
  hideAmounts: boolean;
  isTesting: boolean;
  isDevServers: boolean;
  isOnline?: boolean;
  nativeLocale: string;
  firmwareUpdateDialogOpen: boolean;
  chartDisplay: TChartDisplay;
  setActiveSidebar: Dispatch<SetStateAction<boolean>>;
  setGuideExists: Dispatch<SetStateAction<boolean>>;
  setHideAmounts: Dispatch<SetStateAction<boolean>>;
  setChartDisplay: Dispatch<SetStateAction<TChartDisplay>>;
  setFirmwareUpdateDialogOpen: Dispatch<SetStateAction<boolean>>;
  toggleGuide: () => void;
  toggleHideAmounts: () => void;
  toggleSidebar: () => void;
  sessionConfig: TSessionConfig;
  updateSessionConfig: (config: TSessionConfig) => void;
};

const AppContext = createContext<AppContextProps>({} as AppContextProps);

export { AppContext };
