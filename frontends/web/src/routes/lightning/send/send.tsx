// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type TPaymentInput, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';

type TSendStep = 'select-payment-input' | 'review' | 'success';

export const Send = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TSendStep>('select-payment-input');
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();

  const resetToPaymentInputEntry = useCallback((nextInputError?: string) => {
    setStep('select-payment-input');
    setPaymentInput(undefined);
    setInputError(nextInputError);
  }, []);

  const submitPaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      setPaymentInput(result);
      setStep('review');
      return true;
    } catch (error) {
      setInputError(toLightningErrorMessage(t, error));
      return false;
    }
  }, [t]);

  const showSuccess = useCallback(() => {
    setStep('success');
  }, []);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    const timeout = window.setTimeout(() => navigate('/lightning'), 1000);
    return () => window.clearTimeout(timeout);
  }, [navigate, step]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.send.title')}</h2>} />
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              inputError={inputError}
              onCancel={() => navigate('/lightning')}
              onSubmit={submitPaymentInput}
            />
          )}
          {step === 'review' && paymentInput && (
            <ReviewStep
              paymentInput={paymentInput}
              backToPaymentInput={resetToPaymentInputEntry}
              onSuccess={showSuccess}
            />
          )}
          {step === 'success' && <SuccessStep />}
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
