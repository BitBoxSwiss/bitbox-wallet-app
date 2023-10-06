/**
 * Copyright 2023 Shift Crypto AG
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
import { cancelConnectKeystore, syncConnectKeystore, TSyncConnectKeystore } from '../api/backend';
import { useSubscribe } from '../hooks/api';
import { SkipForTesting } from '../routes/device/components/skipfortesting';

export function KeystoreConnectPrompt() {
  const { t } = useTranslation();
  const data: undefined | TSyncConnectKeystore = useSubscribe(syncConnectKeystore());
  if (!data) {
    return null;
  }
  switch (data.typ) {
  case 'connect':
    // TODO: make this look nice.
    return (
      <>
        { data.keystoreName === '' ?
          t('connectKeystore.promptNoName') :
          t('connectKeystore.promptWithName', { name: data.keystoreName })
        }
        {/* Software keystore is unlocked from the app, so we add the button here.
            The BitBox02 unlock is triggered by inserting it using the globally mounted BitBox02Wizard.
            Te BitBox01 is ignored - BitBox01 users will simply need to unlock before being prompted.
          */}
        <SkipForTesting />
        <button onClick={() => cancelConnectKeystore()}>{t('dialog.cancel')}</button>
      </>
    );
  default:
    return null;
  }
}
