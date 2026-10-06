// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import { type TLightningURI, type TPaymentInput, getParsePaymentInput, postClearLightningURI } from '@/api/lightning';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { ReviewStep } from './components/review-step';
import { SelectPaymentInputStep } from './components/select-payment-input-step';
import { SuccessStep } from './components/success-step';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { LightningSendGuide } from '../guide';
import { useLightning } from '@/hooks/lightning';
import { useMountedRef } from '@/hooks/mount';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import { Message } from '@/components/message/message';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';

type TSendStep = 'select-payment-input' | 'external-input' | 'review' | 'success';

type TProps = {
  activeAccounts: TAccount[];
  uriRequest?: TLightningURI;
};

export const Send = ({ activeAccounts, uriRequest }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TSendStep>(
    uriRequest && uriRequest.input !== null ? 'external-input' : 'select-payment-input',
  );
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [inputError, setInputError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [externalInput, setExternalInput] = useState<TLightningURI>();
  const { isLightningReady, lightningAccount, lightningSDKStatus } = useLightning();
  const mounted = useMountedRef();
  const parseRequest = useRef(0);
  const handledURI = useRef(0);
  const hasSendAttempt = useRef(false);

  const handleSendingChange = useCallback((sending: boolean) => {
    // Keep the review and retry key across errors, until success or leaving the review.
    if (sending) {
      hasSendAttempt.current = true;
    }
    setIsSending(sending);
  }, []);

  const resetToPaymentInputEntry = useCallback((nextInputError?: string) => {
    parseRequest.current++;
    hasSendAttempt.current = false;
    setIsSending(false);
    setStep('select-payment-input');
    setPaymentInput(undefined);
    setInputError(nextInputError);
  }, []);

  const submitPaymentInput = useCallback(async (rawInput: string) => {
    const request = ++parseRequest.current;
    setInputError(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      if (!mounted.current || request !== parseRequest.current) {
        return false;
      }
      setPaymentInput(result);
      setStep('review');
      return true;
    } catch (error) {
      if (!mounted.current || request !== parseRequest.current) {
        return false;
      }
      setInputError(toLightningErrorMessage(t, error));
      setStep('select-payment-input');
      return false;
    }
  }, [mounted, t]);

  useEffect(() => {
    if (!uriRequest || uriRequest.input === null || uriRequest.revision <= handledURI.current || hasSendAttempt.current) {
      return;
    }
    parseRequest.current++;
    setExternalInput(uriRequest);
    setStep('external-input');
    if (!isLightningReady) {
      return;
    }
    handledURI.current = uriRequest.revision;
    submitPaymentInput(uriRequest.input).then(() => {
      postClearLightningURI(uriRequest.revision).catch(console.error);
    });
  }, [isLightningReady, step, submitPaymentInput, uriRequest]);

  const showSuccess = useCallback(() => {
    hasSendAttempt.current = false;
    setIsSending(false);
    setStep('success');
  }, []);

  const handleBack = () => {
    if (step === 'review') {
      resetToPaymentInputEntry();
      return;
    }
    parseRequest.current++;
    if (uriRequest && uriRequest.input !== null) {
      handledURI.current = uriRequest.revision;
      postClearLightningURI(uriRequest.revision).catch(console.error);
    }
    navigate(lightningAccount === null ? '/' : '/lightning');
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
          <Header
            variant="navigation"
            mobileBackButton={step !== 'success' && !isSending}
            onBack={handleBack}
            title={t('lightning.send.title')}
          />
          {step === 'external-input' && (
            <View textCenter verticallyCentered>
              <ViewContent>
                {lightningAccount === null ? (
                  <Message type="warning">{t('lightning.send.activationRequired')}</Message>
                ) : lightningSDKStatus === 'failed' ? (
                  <Message type="warning">{t('lightning.initializationFailed')}</Message>
                ) : (
                  <>
                    <SpinnerRingAnimated />
                    {!isLightningReady && <p>{t('lightning.initializing')}</p>}
                  </>
                )}
              </ViewContent>
              <ViewButtons>
                {lightningAccount === null && (
                  <Button primary onClick={() => navigate('/lightning/activate')}>
                    {t('lightning.activate.title')}
                  </Button>
                )}
                <Button secondary onClick={handleBack}>{t('dialog.cancel')}</Button>
              </ViewButtons>
            </View>
          )}
          {step === 'select-payment-input' && (
            <SelectPaymentInputStep
              activeAccounts={activeAccounts}
              initialValue={externalInput?.input ?? undefined}
              inputError={inputError}
              onCancel={() => navigate('/lightning')}
              onSubmit={submitPaymentInput}
              onClearError={() => setInputError(undefined)}
            />
          )}
          {step === 'review' && paymentInput && (
            <ReviewStep
              key={externalInput?.revision}
              paymentInput={paymentInput}
              backToPaymentInput={resetToPaymentInputEntry}
              onSendingChange={handleSendingChange}
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
