// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext, createContext, useEffect, useState, useCallback } from 'react';
import { runningOnMobile } from '@/utils/env';
import { AppContext } from './AppContext';

export type THandler = () => boolean;

type TProps = {
  pushHandler: (handler: THandler) => void;
  popHandler: (handler: THandler) => void;
};

export const BackButtonContext = createContext<TProps>({
  pushHandler: () => {
    console.error('pushHandler called out of context');
    return true;
  },
  popHandler: () => {
    console.error('popHandler called out of context');
    return true;
  },
});

type TProviderProps = {
  children: ReactNode;
};

export const BackButtonProvider = ({ children }: TProviderProps) => {
  const [handlers, setHandlers] = useState<THandler[]>([]);
  const { guideShown, toggleGuide } = useContext(AppContext);

  const callTopHandler = useCallback(() => {
    // On mobile, the guide covers the whole screen.
    // Make the back button remove the guide first.
    // On desktop the guide does not cover everything and one can keep navigating while it is visible.
    if (runningOnMobile() && guideShown) {
      toggleGuide();
      return false;
    }

    if (handlers.length > 0) {
      const topHandler = handlers[handlers.length - 1] as THandler;
      return topHandler();
    }
    return true;
  }, [handlers, guideShown, toggleGuide]);

  const pushHandler = useCallback((handler: THandler) => {
    setHandlers((prevStack) => [...prevStack, handler]);
  }, []);

  const popHandler = useCallback((handler: THandler) => {
    setHandlers((prevStack) => {
      const index = prevStack.indexOf(handler);
      if (index === -1) {
        // Should never happen.
        return prevStack;
      }
      const res = prevStack.slice(0, index).concat(prevStack.slice(index + 1));
      return res;
    });
  }, []);

  // Install back button callback that is called from Android/iOS.
  useEffect(() => {
    window.onBackButtonPressed = callTopHandler;
    return () => {
      delete window.onBackButtonPressed;
    };
  }, [callTopHandler]);


  return (
    <BackButtonContext.Provider value={{ pushHandler, popHandler }}>
      {children}
    </BackButtonContext.Provider>
  );
};
