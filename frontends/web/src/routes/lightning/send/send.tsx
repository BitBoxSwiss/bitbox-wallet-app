// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type TPaymentInputType, TSdkError, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ReviewStep } from './components/review-step';
import { SelectInvoiceStep } from './components/select-invoice-step';
import { SuccessStep } from './components/success-step';

type TSendStep = 'select-invoice' | 'review' | 'success';

export const Send = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TSendStep>('select-invoice');
  const [paymentDetails, setPaymentDetails] = useState<TPaymentInputType>();
  const [inputError, setInputError] = useState<string>();

  const toErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof TSdkError) {
      if (error.code) {
        return t(`error.${error.code}`);
      }
      return error.message;
    }
    return String(error);
  }, [t]);

  const resetToInvoiceEntry = useCallback((nextInputError?: string) => {
    setStep('select-invoice');
    setPaymentDetails(undefined);
    setInputError(nextInputError);
  }, []);

  const submitPaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      setPaymentDetails(result);
      setStep('review');
      return true;
    } catch (error) {
      setInputError(toErrorMessage(error));
      return false;
    }
  }, [toErrorMessage]);

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
          {step === 'select-invoice' && (
            <SelectInvoiceStep
              inputError={inputError}
              onCancel={() => navigate('/lightning')}
              onSubmit={submitPaymentInput}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              paymentDetails={paymentDetails}
              backToSelectInvoice={resetToInvoiceEntry}
              onSuccess={showSuccess}
            />
          )}
          {step === 'success' && <SuccessStep />}
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
