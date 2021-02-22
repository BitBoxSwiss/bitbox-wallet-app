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

import { Unsubscribe } from './event';
import { IUnsubscribe as UnsubscribeLegacy } from './event-legacy';

export type UnsubscribeList = Array<(Unsubscribe | UnsubscribeLegacy)>;

/**
 * Helper function that takes an array of unsubscribe callbacks.
 * It calls and removes all unsubscribers from the array.
 * This is only useful if you component has more than 1 subscribtion.
 */

export function unsubscribe(unsubscribeList: UnsubscribeList) {
    for (const unsubscribeCallback of unsubscribeList) {
        unsubscribeCallback();
    }
    unsubscribeList.splice(0, unsubscribeList.length);
}
