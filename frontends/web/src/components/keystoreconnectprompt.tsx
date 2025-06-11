/**
 * Copyright 2023-2024 Shift Crypto AG
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
import { ReactElement } from 'react';
import { Button } from './forms';
import { Bluetooth } from '@/components/bluetooth/bluetooth';
import { TConnectKeystoreErrorCode, cancelConnectKeystore, syncConnectKeystore } from '@/api/backend';
import { useSubscribeReset } from '@/hooks/api';
import { Dialog, DialogButtons } from './dialog/dialog';
import { BitBox02StylizedDark, BitBox02StylizedLight, Cancel, PointToBitBox02 } from './icon';
import { useDarkmode } from '@/hooks/darkmode';
import { UseBackButton } from '@/hooks/backbutton';
import { runningInIOS } from '@/utils/env';
import { SkipForTesting } from '@/routes/device/components/skipfortesting';
import styles from './keystoreconnectprompt.module.css';

export const KeystoreConnectPrompt = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();

  const [data, reset] = useSubscribeReset(syncConnectKeystore());

  const cancelAndReset = () => {
    // This is needed to close the popup in case of timeout exception.
    reset();
    cancelConnectKeystore();
  };

  const errorMessage = (errorCode: TConnectKeystoreErrorCode | undefined): ReactElement | null => {
    switch (errorCode) {
    case 'wrongKeystore':
      return (
        <>
          {t('error.wrongKeystore')}
          <br />
          <br />
          {t('error.wrongKeystore2')}
        </>
      );
    case 'timeout':
      return (
        <>
          {t('error.keystoreTimeout')}
        </>
      );
    default:
      return null;
    }
  };

  if (!data) {
    return null;
  }

  switch (data.typ) {
  case 'connect':
    return (
      <Dialog title={t('welcome.connect')} medium open>
        <UseBackButton handler={() => {
          cancelAndReset();
          return false;
        }} />
        <p className={styles.text}>{ data.keystoreName === '' ?
          t('connectKeystore.promptNoName') :
          t('connectKeystore.promptWithName', { name: data.keystoreName })
        }.
        </p>
        <div className={styles.bitboxContainer}>
          {/*
          Software keystore is unlocked from the app, so we add the SkipForTesting button here (only for development).
          The BitBox02 unlock is triggered by inserting it using the globally mounted BitBox02Wizard.
          The BitBox01 is ignored - BitBox01 users will simply need to unlock before being prompted.
          For iOS, the device picker is needed.
          */}
          { !runningInIOS() ? <PointToBitBox02 /> : null }
          <Bluetooth peripheralContainerClassName={styles.bluetoothPeripheralContainer} />
          <div className={!runningInIOS() ? '' : styles.unlockTestButtonContainer}>
            <SkipForTesting />
          </div>
        </div>
        <div className={styles.dialogButtonsContainer}>
          <DialogButtons>
            <Button secondary onClick={cancelConnectKeystore}>{t('dialog.cancel')}</Button>
          </DialogButtons>
        </div>
      </Dialog>
    );
  case 'error':
    const err = errorMessage(data.errorCode);
    return (
      <Dialog title={t('welcome.connect')} medium open>
        <UseBackButton handler={() => {
          cancelAndReset();
          return false;
        }} />
        <p className={styles.text}>
          { err ? err : data.errorMessage }
        </p>
        <div className={`${styles.bitboxContainer} ${styles.failed}`}>
          <Cancel className={styles.cancelIcon} />
          {isDarkMode ?
            <BitBox02StylizedLight className={styles.bitboxImage} /> :
            <BitBox02StylizedDark className={styles.bitboxImage} />
          }
          <SkipForTesting />
        </div>
        <DialogButtons>
          <Button secondary onClick={cancelAndReset}>{t('dialog.cancel')}</Button>
        </DialogButtons>
      </Dialog>
    );
  default:
    return null;
  }
};
