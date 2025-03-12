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

import { useTranslation } from 'react-i18next';
import { useSync } from '@/hooks/api';
import { connect, getState, syncState } from '@/api/bluetooth';
import { runningInIOS } from '@/utils/env';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { Badge } from '@/components/badge/badge';
import styles from './bluetooth.module.css';

const _Bluetooth = () => {
  const { t } = useTranslation();
  const state = useSync(getState, syncState);
  if (!state) {
    return null;
  }
  if (!state.bluetoothAvailable) {
    return <>Please turn on Bluetooth</>;
  }
  return (
    <>
      <div className={styles.label}>
        {t('bluetooth.select')}
      </div>
      <div className={styles.container}>
        { state.scanning ? 'scanning' : null }
        {state.peripherals.map(peripheral => {
          return (
            <ActionableItem
              key={peripheral.identifier}
              onClick={() => connect(peripheral.identifier)}>
              <span>
                { peripheral.name !== '' ? peripheral.name : peripheral.identifier }
                {' '}
                { peripheral.connectionState === 'error' ? (
                  <Badge type="danger">
                    {t('bluetooth.connectionFailed')}
                  </Badge>
                ) : null }
                { peripheral.connectionState === 'error' ? (
                  <p>{ peripheral.connectionError }</p>
                ) : peripheral.connectionState }
              </span>

            </ActionableItem>
          );
        })}
      </div>
    </>
  );
};

export const Bluetooth = () => {
  if (!runningInIOS()) {
    return null;
  }
  return <_Bluetooth />;
};
