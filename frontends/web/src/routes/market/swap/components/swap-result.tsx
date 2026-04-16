// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode, TSendTx } from '@/api/account';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms/button';
import { CopyableInput } from '@/components/copy/Copy';
import { SubTitle } from '@/components/title';

type TProps = {
  children?: ReactNode;
  buyAccountCode: AccountCode;
  onContinue: () => void;
  result: TSendTx | undefined;
};

export const SwapResult = ({
  children,
  buyAccountCode,
  onContinue,
  result,
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
            <p>
              {t('send.abort')}
            </p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(`/account/${buyAccountCode}`)}>
              {t('button.done')}
            </Button>
            <Button secondary onClick={() => onContinue()}>
              {t('send.edit')}
            </Button>
          </ViewButtons>
        </View>
      );
    }

    // TODO: handle erc20InsufficientGasFunds similarly to
    // frontends/web/src/routes/account/send/components/result.tsx
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
            value={result.errorMessage}
          />
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={() => navigate(`/account/${buyAccountCode}`)}>
            {t('button.done')}
          </Button>
          <Button secondary onClick={() => onContinue()}>
            {t('send.edit')}
          </Button>
        </ViewButtons>
      </View>
    );
  }

  return (
    <View fullscreen textCenter verticallyCentered width="520px">
      <ViewHeader />
      <ViewContent withIcon="success">
        <p>
          {t('swap.completed')}
        </p>
        {children}
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={() => navigate(`/account/${buyAccountCode}`)}>
          {t('button.done')}
        </Button>
        <Button secondary onClick={() => onContinue()}>
          {t('swap.new')}
        </Button>
      </ViewButtons>
    </View>
  );
};
