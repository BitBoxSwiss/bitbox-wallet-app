// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import { type TPaymentInput, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { LightningSendGuide } from '../guide';
import { Spinner } from '@/components/spinner/Spinner';
import { useMountedRef } from '@/hooks/mount';

type TSendStep = 'loading-payment-input' | 'select-payment-input' | 'review' | 'success';

type TProps = {
  activeAccounts: TAccount[];
  initialPaymentInput?: string;
  onClose?: (error?: string) => void;
};

export const Send = ({ activeAccounts, initialPaymentInput, onClose }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const consumedPaymentInput = useRef<string | null>(null);
  const mounted = useMountedRef();
  const [step, setStep] = useState<TSendStep>(initialPaymentInput ? 'loading-payment-input' : 'select-payment-input');
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();
  const [isSending, setIsSending] = useState(false);

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      navigate('/lightning');
    }
  }, [navigate, onClose]);

  const resetToPaymentInputEntry = useCallback((nextInputError?: string) => {
    if (onClose) {
      onClose(nextInputError);
      return;
    }
    setIsSending(false);
    setStep('select-payment-input');
    setPaymentInput(undefined);
    setInputError(nextInputError);
  }, [onClose]);

  const submitPaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      if (!mounted.current) {
        return false;
      }
      setPaymentInput(result);
      setStep('review');
      return true;
    } catch (error) {
      if (mounted.current) {
        resetToPaymentInputEntry(toLightningErrorMessage(t, error));
      }
      return false;
    }
  }, [mounted, resetToPaymentInputEntry, t]);

  useEffect(() => {
    if (!initialPaymentInput || consumedPaymentInput.current === initialPaymentInput) {
      return;
    }
    consumedPaymentInput.current = initialPaymentInput;
    setStep('loading-payment-input');
    submitPaymentInput(initialPaymentInput);
  }, [initialPaymentInput, submitPaymentInput]);

  const showSuccess = useCallback(() => {
    setIsSending(false);
    setStep('success');
  }, []);

  const handleBack = () => {
    if (step === 'review') {
      resetToPaymentInputEntry();
      return;
    }
    close();
  };

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    const timeout = window.setTimeout(close, 1000);
    return () => window.clearTimeout(timeout);
  }, [close, step]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          {isSending && <UseDisableBackButton />}
          <Header
            variant="navigation"
            mobileBackButton={step !== 'success' && !isSending}
            onBack={handleBack}
            title={t('lightning.send.title')}
          />
          {step === 'loading-payment-input' && <Spinner text={t('loading')} />}
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              activeAccounts={activeAccounts}
              inputError={inputError}
              onCancel={close}
              onSubmit={submitPaymentInput}
              onClearError={() => setInputError(undefined)}
            />
          )}
          {step === 'review' && paymentInput && (
            <ReviewStep
              paymentInput={paymentInput}
              backToPaymentInput={resetToPaymentInputEntry}
              onSendingChange={setIsSending}
              onSuccess={showSuccess}
            />
          )}
          {step === 'success' && <SuccessStep />}
        </Main>
      </GuidedContent>
      {step !== 'success' && <LightningSendGuide />}
    </GuideWrapper>
  );
};
