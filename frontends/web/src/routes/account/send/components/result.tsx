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

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TSendTx } from '@/api/account';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms/button';
import { alertUser } from '@/components/alert/Alert';

type TProps = {
  code: AccountCode;
  onContinue: () => void;
  result: TSendTx | undefined;
};

/**
 * Renders the final step of send workflow, either success or error message
 * @param result response type TSendTx
 * @returns view
 */
export const SendResult = ({
  code,
  result,
  onContinue,
}: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!result) {
    return null;
  }

  const isAborted = 'aborted' in result;

  if (!result.success && !isAborted) {
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
    <View fullscreen textCenter verticallyCentered width="520px">
      <ViewHeader />
      <ViewContent withIcon={result.success ? 'success' : 'error'}>
        <p>
          { result.success ? t('send.success') : t('send.abort') }
        </p>
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={() => navigate(`/account/${code}`)}>Done</Button>
        <Button secondary onClick={() => onContinue()}>New transaction</Button>
      </ViewButtons>
    </View>
  );
};
