// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RouteComponentProps, useLocation } from 'wouter';
import { type TPaymentInput, TPaymentInputType, getParsePaymentInput } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { LightningSendGuide } from '../guide';
import { Spinner } from '@/components/spinner/Spinner';
import { useMountedRef } from '@/hooks/mount';
import { useAppState } from '@/contexts/app-state-context';
import { ContactForm } from '../contacts/contact-form';

type TSendStep = 'loading-payment-input' | 'select-payment-input' | 'review' | 'success' | 'add-contact';

type TProps = RouteComponentProps & {
  initialPaymentInput?: string;
  initialRecipientAddress?: string;
  onClose?: (error?: string) => void;
};

export const Send = ({ initialPaymentInput, initialRecipientAddress = '', onClose }: TProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { activeAccounts } = useAppState();
  const consumedPaymentInput = useRef<string | null>(null);
  const mounted = useMountedRef();
  const [step, setStep] = useState<TSendStep>(initialPaymentInput ? 'loading-payment-input' : 'select-payment-input');
  const [recipientInput, setRecipientInput] = useState(initialRecipientAddress);
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const recipientAddress = paymentInput?.type === TPaymentInputType.LNURL_PAY ? paymentInput.lnurlPay.address : undefined;

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
      setRecipientInput(rawInput);
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
    if (step !== 'success' || recipientAddress) {
      return;
    }

    const timeout = window.setTimeout(close, 1000);
    return () => window.clearTimeout(timeout);
  }, [close, recipientAddress, step]);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          {isSending && <UseDisableBackButton />}
          {step !== 'add-contact' && (
            <Header
              variant="navigation"
              mobileBackButton={step !== 'success' && !isSending}
              onBack={handleBack}
              title={t('lightning.send.title')}
            />
          )}
          {step === 'loading-payment-input' && <Spinner text={t('loading')} />}
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              activeAccounts={activeAccounts}
              initialRecipientAddress={recipientInput}
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
          {step === 'success' && <SuccessStep address={recipientAddress} onAddContact={() => setStep('add-contact')} onDone={close} />}
          {step === 'add-contact' && <ContactForm initialAddress={recipientAddress} onCancel={() => setStep('success')} onDone={close} />}
        </Main>
      </GuidedContent>
      {step !== 'success' && step !== 'add-contact' && <LightningSendGuide />}
    </GuideWrapper>
  );
};
