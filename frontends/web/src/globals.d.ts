/**
 * Copyright 2022 Shift Crypto AG
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

import { TPayload } from './utils/transport-common';

export declare global {
    interface Window {
        qt?: { webChannelTransport: unknown; };
        android?: {
            call: (queryID: number, query: string) => void;
        }
        onMobileCallResponse?: (queryID: number, response: unknown) => void;
        onMobilePushNotification?: (msg: TPayload) => void;
        runningOnIOS?: boolean;
        // Called by Android when the back button is pressed.
        onBackButtonPressed?: () => boolean;
        webkit?: {
          messageHandlers: {
            goCall: {
              postMessage: (msg: { queryID: number; query: string; }) => void;
            }
            appReady: {
              postMessage: (msg: any) => void;
            }
          }
        }
    }
}
