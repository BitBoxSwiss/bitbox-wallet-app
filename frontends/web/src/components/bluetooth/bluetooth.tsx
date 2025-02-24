/**
 * Copyright 2025 Shift Crypto AG
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

import { useSync } from '@/hooks/api';
import { connect, getState, syncState } from '@/api/bluetooth';
import { runningInIOS } from '@/utils/env';

const _Bluetooth = () => {
  const state = useSync(getState, syncState);
  if (!state) {
    return null;
  }
  return (
    <span>
      { state.peripherals.map(peripheral => {
        return (
          <p key={peripheral.identifier}>
            { peripheral.identifier }
            { peripheral.connectionFailed ? ' [failed]' : null }
            <button onClick={() => connect(peripheral.identifier)}>connect</button>
          </p>
        );
      })}
    </span>
  );
};

export const Bluetooth = () => {
  if (!runningInIOS()) {
    return null;
  }
  return <_Bluetooth />;
};
