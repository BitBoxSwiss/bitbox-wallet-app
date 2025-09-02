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
