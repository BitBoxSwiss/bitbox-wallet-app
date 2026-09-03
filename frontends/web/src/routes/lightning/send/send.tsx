// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import { type TPaymentInput, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { LightningSendGuide } from '../guide';

type TSendStep = 'select-payment-input' | 'review' | 'success';

type TProps = {
  activeAccounts: TAccount[];
};

export const Send = ({ activeAccounts }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TSendStep>('select-payment-input');
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();
  const [isSending, setIsSending] = useState(false);

  const resetToPaymentInputEntry = useCallback((nextInputError?: string) => {
    setIsSending(false);
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
    setIsSending(false);
    setStep('success');
  }, []);

  const handleBack = () => {
    if (step === 'review') {
      resetToPaymentInputEntry();
      return;
    }
    navigate('/lightning');
  };

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
          {isSending && <UseDisableBackButton />}
          <Header title={
            <>
              <h2 className="hide-on-small">{t('lightning.send.title')}</h2>
              <MobileHeader
                onClick={handleBack}
                title={t('lightning.send.title')}
                variant={step === 'success' || isSending ? 'titleOnly' : 'back'}
              />
            </>
          } />
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              activeAccounts={activeAccounts}
              inputError={inputError}
              onCancel={() => navigate('/lightning')}
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
