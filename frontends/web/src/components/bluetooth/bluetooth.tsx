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
import { useEffect, useRef, useState } from 'react';
import { useSync } from '@/hooks/api';
import { connect, getState, syncState, TPeripheral } from '@/api/bluetooth';
import { runningInIOS } from '@/utils/env';
import { Status } from '@/components/status/status';
import { ActionableItem } from '@/components/actionable-item/actionable-item';
import { Badge } from '@/components/badge/badge';
import { HorizontallyCenteredSpinner, SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { Button } from '@/components/forms';
import { ConnectionIssuesDialog } from '@/components/bluetooth/connection-issues-dialog';
import styles from './bluetooth.module.css';

const isConnectedOrConnecting = (peripheral: TPeripheral) => {
  return peripheral.connectionState === 'connecting' || peripheral.connectionState === 'connected';
};

type Props = {
  peripheralContainerClassName?: string;
}

const _Bluetooth = ({ peripheralContainerClassName }: Props) => {
  const { t } = useTranslation();
  const state = useSync(getState, syncState);
  const [showConnectionIssues, setShowConnectionIssues] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const scanningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TIMEOUT_MS = 30000;

  useEffect(() => {
    if (state?.scanning) {
      scanningTimeoutRef.current = setTimeout(() => {
        if (state.scanning && state.peripherals.length === 0) {
          setShowConnectionIssues(true);
        }
      }, TIMEOUT_MS);
    } else {
      if (scanningTimeoutRef.current) {
        clearTimeout(scanningTimeoutRef.current);
        scanningTimeoutRef.current = null;
      }
      setShowConnectionIssues(false);
    }

    return () => {
      if (scanningTimeoutRef.current) {
        clearTimeout(scanningTimeoutRef.current);
      }
    };
  }, [state?.scanning, state?.peripherals.length]);

  if (!state) {
    return null;
  }
  if (!state.bluetoothAvailable) {
    return (
      <Status type="warning">
        {t('bluetooth.enable')}
      </Status>
    );
  }
  const hasConnection = state.peripherals.some(isConnectedOrConnecting);
  return (
    <>
      <div className={styles.label}>
        {t('bluetooth.select')}
      </div>
      <div className={styles.container}>
        {state.peripherals.map(peripheral => {
          const onClick = !hasConnection ? () => connect(peripheral.identifier) : undefined;
          const connectingIcon = peripheral.connectionState === 'connecting' ? (
            <SpinnerRingAnimated />
          ) : undefined;
          return (
            <ActionableItem
              className={peripheralContainerClassName}
              key={peripheral.identifier}
              icon={connectingIcon}
              onClick={onClick}>
              <span>
                { peripheral.name !== '' ? peripheral.name : peripheral.identifier }
                {' '}
                { peripheral.connectionState === 'connected' ? (
                  <Badge type="success">
                    {t('bluetooth.connected')}
                  </Badge>
                ) : null }
                { peripheral.connectionState === 'error' ? (
                  <Badge type="danger">
                    <span style={{ whiteSpace: 'wrap' }}>
                      {peripheral.connectionError}
                    </span>
                  </Badge>
                ) : null }
              </span>
            </ActionableItem>
          );
        })}
      </div>
      {state.scanning && (
        <div>
          <HorizontallyCenteredSpinner />
        </div>
      )}

      {showConnectionIssues && (
        <div className={styles.connectionIssuesLink}>
          <Button
            transparent
            onClick={(e) => {
              e.preventDefault();
              setDialogOpen(true);
            }}
          >
            {t('bluetooth.connectionIssues')}
          </Button>
        </div>
      )}

      <ConnectionIssuesDialog dialogOpen={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export const Bluetooth = ({ peripheralContainerClassName = '' }: Props) => {
  if (!runningInIOS()) {
    return null;
  }
  return <_Bluetooth peripheralContainerClassName={peripheralContainerClassName} />;
};
