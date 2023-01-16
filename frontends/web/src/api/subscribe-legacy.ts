/**
 * Copyright 2021 Shift Crypto AG
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

import { subscribe, TUnsubscribe } from '../utils/event-legacy';

export const statusChanged = (
  code: string,
  cb: (code: string) => void,
): TUnsubscribe => {
  const unsubscribe = subscribe('statusChanged', data => {
    if (data.type === 'account' && data.code === code) {
      cb(code);
    }
  });
  return unsubscribe;
};

export const syncdone = (
  code: string,
  cb: (code: string) => void,
): TUnsubscribe => {
  return subscribe('syncdone', data => {
    if (data.type === 'account' && data.code === code) {
      cb(code);
    }
  });
};
