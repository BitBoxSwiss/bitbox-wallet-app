// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext } from 'react';

export type TGlobalBannersContainer = {
  element: HTMLDivElement;
  restore: () => void;
};

export const GlobalBannersContainerContext = createContext<TGlobalBannersContainer | null>(null);

export const useGlobalBannersContainer = () => useContext(GlobalBannersContainerContext);
