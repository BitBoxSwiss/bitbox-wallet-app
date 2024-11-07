/**
 * Copyright 2024 Shift Crypto AG
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

import { ReactNode, useContext, createContext, useEffect, useState, useCallback } from 'react';
import { runningOnMobile } from '@/utils/env';
import { AppContext } from './AppContext';

export type THandler = () => boolean;

type TProps = {
  pushHandler: (handler: THandler) => void;
  popHandler: (handler: THandler) => void;
}

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
}

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
      const topHandler = handlers[handlers.length - 1];
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
