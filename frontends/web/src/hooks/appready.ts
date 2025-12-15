// SPDX-License-Identifier: Apache-2.0

import { runningInIOS } from '@/utils/env';
import { useEffect } from 'react';

/**
 * Hook to signal to native iOS WebView that React app is ready to be shown.
 * This prevents the white flicker on app launch by keeping the WebView hidden
 * until the React app has finished loading its initial data.
 */
export const useAppReady = () => {
  useEffect(() => {
    if (runningInIOS() && window.webkit?.messageHandlers.appReady) {
      window.webkit.messageHandlers.appReady.postMessage({});
    }
  }, []);

  useEffect(() => {
    // fallback: send appReady after 3 seconds
    setTimeout(() => {
      if (runningInIOS() && window.webkit?.messageHandlers.appReady) {
        window.webkit.messageHandlers.appReady.postMessage({});
      }
    }, 3000);
  }, []);
};
