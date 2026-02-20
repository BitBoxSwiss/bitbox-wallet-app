// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { useSync } from '@/hooks/api';
import { connect, getState, syncState, TPeripheral } from '@/api/bluetooth';
import { runningInIOS } from '@/utils/env';
import { Message } from '@/components/message/message';
import { A } from '@/components/anchor/anchor';
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
};

const BluetoothInner = ({ peripheralContainerClassName }: Props) => {
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

  // if Bluetooth is unauthorized, prompt the user to enable it
  // since its on/off state is unknown
  if (state.bluetoothUnauthorized) {
    return (
      <Message type="warning">
        <div className={styles.bluetoothDisabledContainer}>
          <span className={styles.bluetoothDisabledTitle}>
            {t('bluetooth.disabledPermissionTitle')}
          </span>
          <span >
            {t('bluetooth.disabledPermissionDescription')}
          </span>
          <A className={styles.link} href="app-settings:">
            {t('generic.enable')}
          </A>
        </div>
      </Message>
    );
  }

  if (!state.bluetoothAvailable) {
    return (
      <Message type="warning">
        <div className={styles.bluetoothDisabledContainer}>
          <span className={styles.bluetoothDisabledTitle}>
            {t('bluetooth.disabledGloballyTitle')}
          </span>
          <span >
            {t('bluetooth.disabledGloballyDescription')}
          </span>
        </div>
      </Message>
    );
  }

  const hasConnection = state.peripherals.some(isConnectedOrConnecting);
  return (
    <>
      {state.peripherals.length > 0 ? (
        <div className={styles.label}>
          {t('bluetooth.select')}
        </div>
      ) : showConnectionIssues ? (
        <Message type="info" className={styles.connectionIssues}>
          <span>
            {t('bluetooth.connectionIssues')}
          </span>
          {' '}
          <Button
            transparent
            className={styles.connectionIssuesButton}
            onClick={(e) => {
              e.preventDefault();
              setDialogOpen(true);
            }}
          >
            {t('bluetooth.connectionIssuesLink')}
          </Button>
        </Message>
      ) : null}
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

      <ConnectionIssuesDialog dialogOpen={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export const Bluetooth = ({ peripheralContainerClassName = '' }: Props) => {
  if (!runningInIOS()) {
    return null;
  }
  return <BluetoothInner peripheralContainerClassName={peripheralContainerClassName} />;
};
