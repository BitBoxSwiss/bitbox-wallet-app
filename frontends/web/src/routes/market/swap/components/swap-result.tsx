// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import type { AccountCode, TSendTx } from '@/api/account';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms/button';
import { CopyableInput } from '@/components/copy/Copy';
import { SubTitle } from '@/components/title';

type TProps = {
  children?: ReactNode;
  buyAccountCode: AccountCode;
  sellAccountCode: AccountCode;
  buyEthAccountCode: AccountCode | undefined;
  onContinue: () => void;
  result: TSendTx | undefined;
};

export const SwapResult = ({
  children,
  buyAccountCode,
  sellAccountCode,
  buyEthAccountCode,
  onContinue,
  result,
}: TProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

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

    if (result.errorCode === 'erc20InsufficientGasFunds') {
      return (
        <View fullscreen textCenter verticallyCentered width="520px">
          <ViewHeader />
          <ViewContent withIcon="error">
            <p>
              {t(`send.error.${result.errorCode}`)}
            </p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(`/account/${buyAccountCode}`)}>
              {t('button.done')}
            </Button>
            {buyEthAccountCode && (
              <Button
                secondary
                onClick={() => navigate(`/market/select/${buyEthAccountCode}`, { replace: true })}>
                {t('send.buyEth')}
              </Button>
            )}
          </ViewButtons>
        </View>
      );
    }

    if (result.errorCode) {
      const broadcastUncertain = result.errorCode === 'broadcastUncertain';
      const errorMessage = (
        result.errorCode === 'wrongKeystore'
          ? (
            <>
              {t('error.wrongKeystore')}
              <br />
              <br />
              {t('error.wrongKeystore2')}
            </>
          )
          : t(`send.error.${result.errorCode}`)
      );

      return (
        <View fullscreen textCenter verticallyCentered width="520px">
          <ViewHeader />
          <ViewContent withIcon="error">
            <p>
              {errorMessage}
            </p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate(`/account/${broadcastUncertain ? sellAccountCode : buyAccountCode}`)}>
              {t('button.done')}
            </Button>
            {!broadcastUncertain && (
              <Button secondary onClick={() => onContinue()}>
                {t('send.edit')}
              </Button>
            )}
          </ViewButtons>
        </View>
      );
    }

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
