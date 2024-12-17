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
import type { TSendTx } from '@/api/account';
import { Cancel, Checked } from '@/components/icon/icon';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { alertUser } from '@/components/alert/Alert';

type TProps = {
  result: TSendTx | undefined;
};

export const MessageWaitDialog = ({ result }: TProps) => {
  const { t } = useTranslation();

  if (!result) {
    return null;
  }

  if (!result.success && !('aborted' in result)) {
    switch (result.errorCode) {
    case 'erc20InsufficientGasFunds':
      alertUser(t(`send.error.${result.errorCode}`));
      break;
    default:
      const { errorMessage } = result;
      if (errorMessage) {
        alertUser(t('unknownError', { errorMessage }));
      } else {
        alertUser(t('unknownError'));
      }
    }
    return null;
  }
  return (
    <WaitDialog>
      <div className="flex flex-row flex-center flex-items-center">
        {result.success && (
          <>
            <Checked style={{ height: 18, marginRight: '1rem' }} />
            {t('send.success')}
          </>
        )}
        {!result.success && result.aborted && (
          <>
            <Cancel alt="Abort" style={{ height: 18, marginRight: '1rem' }} />
            {t('send.abort')}
          </>
        )}
      </div>
    </WaitDialog>
  );
};
