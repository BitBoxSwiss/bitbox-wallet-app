// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccountCode } from '@/api/account';
import type { FailResponse, SuccessResponse } from '@/api/response';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms/button';

// TODO: import response type from api/swap
type swapResponse = SuccessResponse | FailResponse;

type TProps = {
  children?: ReactNode;
  buyAccountCode?: AccountCode;
  onContinue: () => void;
  // onRetry: () => void;
  result: swapResponse | undefined;
};

export const SwapResult = ({
  children,
  buyAccountCode = 'DUMMYCODE_JUST_FOR_TESTING',
  onContinue,
  // onRetry,
  result,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!result) {
    return null;
  }

  // TODO: add aborted, erc20InsufficientGasFunds or unknownError views
  // see similar component: frontends/web/src/routes/account/send/components/result.tsx

  return (
    <View fullscreen textCenter verticallyCentered width="520px">
      <ViewHeader />
      <ViewContent withIcon="success">
        <p>
          Swap completed
        </p>
        {children}
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={() => navigate(`/account/${buyAccountCode}`)}>
          {t('button.done')}
        </Button>
        <Button secondary onClick={() => onContinue()}>
          New swap
        </Button>
      </ViewButtons>
    </View>
  );
};
