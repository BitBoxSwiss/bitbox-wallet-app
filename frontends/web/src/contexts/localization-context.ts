// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react';

type LocalizationContextProps = {
  decimal: string;
  group: string;
};


export const LocalizationContext = createContext<LocalizationContextProps>({}as LocalizationContextProps);
