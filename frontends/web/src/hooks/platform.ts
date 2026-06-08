// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';

const getPlatformFromUA = (userAgent: string) => {
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
