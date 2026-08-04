// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { runningInAndroid } from '@/utils/env';

export const useAndroidKeyboardVisible = (): boolean => {
  const [keyboardVisible, setKeyboardVisible] = useState(() => (
    runningInAndroid() && window.androidKeyboardVisible === true
  ));

  useEffect(() => {
    if (!runningInAndroid()) {
      return;
    }

    window.onKeyboardVisibilityChanged = setKeyboardVisible;

    return () => {
      delete window.onKeyboardVisibilityChanged;
    };
  }, []);

  return keyboardVisible;
};
