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

import { useEffect } from 'react';

export const getPlatformFromUA = (userAgent: string) => {
  if (userAgent.includes('win')) {
    return 'windows';
  } else if (userAgent.includes('mac')) {
    // IOS userAgents will include Mac
    if (
      userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')
    ) {
      return 'ios';
    }
    return 'macos';
  } else if (userAgent.includes('linux')) {
    // Android userAgent will also include Linux.
    if (userAgent.includes('android')
      || userAgent.includes('samsungbrowser')
    ) {
      return 'android';
    }
    return 'linux';
  } else if (userAgent.includes('cros') || userAgent.includes('chromebook')) {
    return 'chromeos';
  } else if (
    userAgent.includes('bsd')
    || userAgent.includes('freebsd')
    || userAgent.includes('openbsd')
    || userAgent.includes('netbsd')
  ) {
    return 'bsd';
  } else {
    return null;
  }
};

/**
 * usePlatformClass adds a CSS class to target a specific platform in CSS
 * CSS class that is added is one of:
 * - os-windows
 * - os-macos
 * - os-ios
 * - os-andoird
 * - os-linux
 * - os-chromeos
 * - os-bsd
 */
export const usePlatformClass = () => {
  const userAgent = navigator.userAgent.toLowerCase();

  useEffect(() => {
    const platform = getPlatformFromUA(userAgent);
    if (platform) {
      document.body.classList.add(`os-${platform}`);
    }
  }, [userAgent]);

};
