
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

import { useTranslation } from 'react-i18next';
import { cancelConnectKeystore, syncConnectKeystore } from '../../../api/backend';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button } from '../../../components/forms';
import { useSubscribeReset } from '../../../hooks/api';
import styles from './confirm-dialog-disable-watchonly.module.css';

type TProps = {
    storedAccountCode: string
    onConfirm: (accountCode: string, watch: boolean) => Promise<void>
}

export const ConfirmDialogDisableWatchonly = ({ storedAccountCode, onConfirm }: TProps) => {
  const { t } = useTranslation();
  const [data] = useSubscribeReset(syncConnectKeystore());

  if (!data) {
    return null;
  }

  switch (data.typ) {
  case 'connect':
    return (
      <>
        <Dialog title="Warning" medium open>
          <p className={styles.text}>{t('manageAccounts.disableWatchOnlyWarning')}</p>
          <DialogButtons>
            <Button primary onClick={async () => {
              await cancelConnectKeystore();
              await onConfirm(storedAccountCode, false);
            }}>Confirm</Button>
            <Button secondary onClick={async() => {
              await cancelConnectKeystore();
            }}>Cancel</Button>
          </DialogButtons>

        </Dialog>
      </>
    );
  default:
    return null;
  }
};
