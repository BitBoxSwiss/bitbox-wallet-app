// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext } from 'react';
import { useLoad } from '@/hooks/api';
import { useDefault } from '@/hooks/default';
import { getNumberFormat } from '@/api/nativelocale';
import { useLocalizedPunctuation } from '@/hooks/localized';
import { LocalizationContext } from './localization-context';
import { AppContext } from './AppContext';

type TProps = {
  children: ReactNode;
};

export const LocalizationProvider = ({ children }: TProps) => {
  const { nativeLocale } = useContext(AppContext);
  const {
    decimal: decimalFromLocale,
    group: groupFromLocale,
  } = useLocalizedPunctuation(nativeLocale);

  const systemNumberFormat = useDefault(useLoad(getNumberFormat), null);

  const decimal = systemNumberFormat?.decimal ?? decimalFromLocale;

  const group = systemNumberFormat?.group ?? groupFromLocale;

  return (
    <LocalizationContext.Provider value={{ decimal, group }}>
      {children}
    </LocalizationContext.Provider>
  );
};