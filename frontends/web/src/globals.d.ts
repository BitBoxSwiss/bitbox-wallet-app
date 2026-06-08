// SPDX-License-Identifier: Apache-2.0

import type { TPayload } from './utils/transport-common';
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

export declare global {
  interface Window {
    qt?: { webChannelTransport: unknown };
    android?: {
      call: (queryID: number, query: string) => void;
    };
    onMobileCallResponse?: (queryID: number, response: unknown) => void;
    onMobilePushNotification?: (msg: TPayload) => void;
    runningOnIOS?: boolean;
    // Called by Android when the back button is pressed.
    onBackButtonPressed?: () => boolean;
    webkit?: {
      messageHandlers: {
        goCall: {
          postMessage: (msg: { queryID: number; query: string }) => void;
        };
        appReady: {
          postMessage: (msg: any) => void;
        };
        hapticFeedback: {
          postMessage: (msg: any) => void;
        };
      };
    };
  }
}
