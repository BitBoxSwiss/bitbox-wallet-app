/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { Dispatch, SetStateAction, createContext } from 'react';

export type TSidebarStatus = '' | 'forceHidden'
export type TChartDisplay = 'week' | 'month' | 'year' | 'all';

type AppContextProps = {
    activeSidebar: boolean;
    guideShown: boolean;
    guideExists: boolean;
    hideAmounts: boolean;
    nativeLocale: string;
    sidebarStatus: string;
    firmwareUpdateDialogOpen: boolean;
    chartDisplay: TChartDisplay;
    setActiveSidebar: Dispatch<SetStateAction<boolean>>;
    setGuideExists: Dispatch<SetStateAction<boolean>>;
    setGuideShown: Dispatch<SetStateAction<boolean>>;
    setSidebarStatus: Dispatch<SetStateAction<TSidebarStatus>>;
    setHideAmounts: Dispatch<SetStateAction<boolean>>;
    setChartDisplay: Dispatch<SetStateAction<TChartDisplay>>;
    setFirmwareUpdateDialogOpen: Dispatch<SetStateAction<boolean>>;
    toggleGuide: () => void;
    toggleHideAmounts: () => void;
    toggleSidebar: () => void;
}

const AppContext = createContext<AppContextProps>({} as AppContextProps);

export { AppContext };
