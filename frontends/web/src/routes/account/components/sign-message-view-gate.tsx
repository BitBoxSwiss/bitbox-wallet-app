// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Message } from '@/components/message/message';
import { Spinner } from '@/components/spinner/Spinner';

type TProps = {
  isLoading: boolean;
  isConnecting: boolean;
  isMessageSigningAvailable: boolean;
  isKeystoreConnected: boolean;
  loadingText: string;
  unsupportedText: string;
  connectFailedText: string;
  retryLabel: string;
  backLabel: string;
  onRetry: () => void;
  onBack: () => void;
  pageSectionClassName: string;
  footerButtonsClassName: string;
  loadingWrapClassName?: string;
  children: ReactNode;
};

export const SignMessageViewGate = ({
  isLoading,
  isConnecting,
  isMessageSigningAvailable,
  isKeystoreConnected,
  loadingText,
  unsupportedText,
  connectFailedText,
  retryLabel,
  backLabel,
  onRetry,
  onBack,
  pageSectionClassName,
  footerButtonsClassName,
  loadingWrapClassName,
  children,
}: TProps) => {
  if (isLoading || isConnecting) {
    return (
      <div className={pageSectionClassName}>
        {loadingWrapClassName ? (
          <div className={loadingWrapClassName}>
            <Spinner text={loadingText} />
          </div>
        ) : (
          <Spinner text={loadingText} />
        )}
      </div>
    );
  }

  if (!isMessageSigningAvailable) {
    return (
      <div className={pageSectionClassName}>
        <Message type="info">{unsupportedText}</Message>
        <div className={footerButtonsClassName}>
          <BackButton onBack={onBack}>
            {backLabel}
          </BackButton>
        </div>
      </div>
    );
  }

  if (!isKeystoreConnected) {
    return (
      <div className={pageSectionClassName}>
        <Message type="error">{connectFailedText}</Message>
        <div className={footerButtonsClassName}>
          <Button primary onClick={onRetry}>
            {retryLabel}
          </Button>
          <BackButton onBack={onBack}>
            {backLabel}
          </BackButton>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
