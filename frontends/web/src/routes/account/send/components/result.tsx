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

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TSendTx } from '@/api/account';
import {
  View,
  ViewButtons,
  ViewContent,
  ViewHeader,
} from '@/components/view/view';
import { Button } from '@/components/forms/button';
import { SubTitle } from '@/components/title';
import { CopyableInput } from '@/components/copy/Copy';

type TProps = {
  children?: ReactNode;
  code: AccountCode;
  onContinue: () => void;
  onRetry: () => void;
  result: TSendTx | undefined;
};

/**
 * Renders the final step of send workflow, either success or error message
 * @param result response type TSendTx
 * @returns view
 */
export const SendResult = ({
  children,
  code,
  result,
  onContinue,
  onRetry,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!result) {
    return null;
  }

  if (!result.success) {
    if ('aborted' in result) {
      return (
        <View fullscreen textCenter verticallyCentered width="520px">
          <ViewHeader />
          <ViewContent withIcon="error">
            <p>{t('send.abort')}</p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(`/account/${code}`)}>
              {t('button.done')}
            </Button>
            <Button secondary onClick={() => onRetry()}>
              {t('send.edit')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
    switch (result.errorCode) {
      case 'erc20InsufficientGasFunds':
        return (
          <View fullscreen textCenter verticallyCentered width="520px">
            <ViewHeader />
            <ViewContent withIcon="error">
              <p>{t(`send.error.${result.errorCode}`)}</p>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={() => navigate(`/account/${code}`)}>
                {t('button.done')}
              </Button>
              <Button
                secondary
                onClick={() =>
                  navigate(`/exchange/select/${code}`, { replace: true })
                }
              >
                {t('send.buyEth')}
              </Button>
            </ViewButtons>
          </View>
        );
      default:
        const { errorMessage } = result;
        return (
          <View fullscreen textCenter verticallyCentered width="640px">
            <ViewHeader />
            <ViewContent withIcon="error">
              <SubTitle>{t('unknownError', { errorMessage: '' })}</SubTitle>
              <CopyableInput alignLeft flexibleHeight value={errorMessage} />
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={() => navigate(`/account/${code}`)}>
                {t('button.done')}
              </Button>
              <Button secondary onClick={() => onRetry()}>
                {t('send.edit')}
              </Button>
            </ViewButtons>
          </View>
        );
    }
  }

  return (
    <View fullscreen textCenter verticallyCentered width="520px">
      <ViewHeader />
      <ViewContent withIcon="success">
        <p>{t('send.success')}</p>
        {children}
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={() => navigate(`/account/${code}`)}>
          {t('button.done')}
        </Button>
        <Button secondary onClick={() => onContinue()}>
          {t('send.newTransaction')}
        </Button>
      </ViewButtons>
    </View>
  );
};
