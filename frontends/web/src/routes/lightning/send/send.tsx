// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { type TPaymentInput, TPaymentInputType, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { LightningSendGuide } from '../guide';
import { useAppState } from '@/contexts/app-state-context';
import { ContactForm } from '../contacts/contact-form';

type TSendStep = 'select-payment-input' | 'review' | 'success' | 'add-contact';

type TProps = {
  initialRecipientAddress?: string;
};

export const Send = ({ initialRecipientAddress = '' }: TProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { activeAccounts } = useAppState();
  const [step, setStep] = useState<TSendStep>('select-payment-input');
  const [recipientInput, setRecipientInput] = useState(initialRecipientAddress);
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const recipientAddress = paymentInput?.type === TPaymentInputType.LNURL_PAY ? paymentInput.lnurlPay.address : undefined;
  const finish = useCallback(() => navigate('/lightning'), [navigate]);

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
      setRecipientInput(rawInput);
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

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          {isSending && <UseDisableBackButton />}
          {step !== 'add-contact' && (
            <Header
              variant="navigation"
              mobileBackButton={(step === 'select-payment-input' || step === 'review') && !isSending}
              onBack={handleBack}
              title={t('lightning.send.title')}
            />
          )}
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              activeAccounts={activeAccounts}
              initialRecipientAddress={recipientInput}
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
          {step === 'success' && <SuccessStep address={recipientAddress} onAddContact={() => setStep('add-contact')} onDone={finish} />}
          {step === 'add-contact' && <ContactForm initialAddress={recipientAddress} onCancel={() => setStep('success')} onDone={finish} />}
        </Main>
      </GuidedContent>
      {(step === 'select-payment-input' || step === 'review') && <LightningSendGuide />}
    </GuideWrapper>
  );
};
