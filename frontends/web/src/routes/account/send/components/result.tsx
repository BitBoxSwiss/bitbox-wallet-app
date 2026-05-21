// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TSendTx } from '@/api/account';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms/button';
import { SubTitle } from '@/components/title';
import { CopyableInput } from '@/components/copy/Copy';

type TProps = {
  children?: ReactNode;
  code: AccountCode;
  doneRoute?: string;
  onContinue?: () => void;
  onRetry: () => void;
  result: TSendTx | undefined;
  showSuccessActions?: boolean;
  successMessage?: string;
};

/**
 * Renders the final step of send workflow, either success or error message
 * @param result response type TSendTx
 * @returns view
 */
export const SendResult = ({
  children,
  code,
  doneRoute,
  onContinue,
  result,
  onRetry,
  showSuccessActions = true,
  successMessage,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const donePath = doneRoute || `/account/${code}`;

  if (!result) {
    return null;
  }

  if (!result.success) {
    if ('aborted' in result) {
      return (
        <View fullscreen textCenter verticallyCentered width="520px">
          <ViewHeader />
          <ViewContent withIcon="error">
            <p>
              {t('send.abort')}
            </p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(donePath)}>
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
            <p>
              {t(`send.error.${result.errorCode}`)}
            </p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(donePath)}>
              {t('button.done')}
            </Button>
            <Button secondary onClick={() => navigate(`/market/select/${code}`, { replace: true })}>
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
            <SubTitle>
              {t('unknownError', { errorMessage: '' })}
            </SubTitle>
            <CopyableInput
              alignLeft
              flexibleHeight
              value={errorMessage || t('genericError')}
            />
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(donePath)}>
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
        <p>
          {successMessage || t('send.success')}
        </p>
        {children}
      </ViewContent>
      {showSuccessActions && (
        <ViewButtons>
          <Button primary onClick={() => navigate(donePath)}>
            {t('button.done')}
          </Button>
          {onContinue && (
            <Button secondary onClick={() => onContinue()}>
              {t('send.newTransaction')}
            </Button>
          )}
        </ViewButtons>
      )}
    </View>
  );
};
