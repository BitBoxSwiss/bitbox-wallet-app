import { ReactNode, useContext } from 'react';
import { useLocalizedPunctuation } from '@/hooks/localized';
import { LocalizationContext } from './localization-context';
import { AppContext } from './AppContext';

type TProps = {
  children: ReactNode;
};

export const LocalizationProvider = ({ children }: TProps) => {
  const { nativeLocale } = useContext(AppContext);
  const { decimal, group } = useLocalizedPunctuation(nativeLocale);

  return (
    <LocalizationContext.Provider value={{ decimal, group }}>
      {children}
    </LocalizationContext.Provider>
  );
};