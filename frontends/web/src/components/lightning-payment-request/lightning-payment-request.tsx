// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { getLightningURI, getParsePaymentInput, postClearLightningURI, subscribeLightningURI, type TPaymentInput } from '@/api/lightning';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { useSync } from '@/hooks/api';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { useLightning } from '@/hooks/lightning';
import { useMediaQuery } from '@/hooks/mediaquery';
import { isLightningFeatureAvailable } from '@/utils/env';
import { ReviewStep } from '@/routes/lightning/send/components/review-step';
import { SuccessStep } from '@/routes/lightning/send/components/success-step';
import { LightningTestnetGuard } from '@/routes/lightning/testnet-warning';
import { Button } from '@/components/forms';
import { Header } from '@/components/layout';
import { Message } from '@/components/message/message';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';

type TProps = {
  input: string;
  onClose: () => void;
};

const PaymentRequest = ({ input, onClose }: TProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isLightningReady, lightningAccount, lightningSDKStatus } = useLightning();
  const [paymentInput, setPaymentInput] = useState<TPaymentInput>();
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isLightningReady || paymentInput || error) {
      return;
    }
    let cancelled = false;
    getParsePaymentInput({ s: input }).then(result => {
      if (!cancelled) {
        setPaymentInput(result);
      }
    }).catch(err => {
      if (!cancelled) {
        setError(toLightningErrorMessage(t, err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [error, input, isLightningReady, paymentInput, t]);

  const backToPaymentInput = useCallback((message?: string) => {
    setIsSending(false);
    if (message) {
      setError(message);
    } else {
      onClose();
    }
  }, [onClose]);

  const onSuccess = useCallback(() => {
    setIsSending(false);
    setSuccess(true);
  }, []);

  const message = (
    error || (lightningAccount === null
      ? t('lightning.send.activationRequired')
      : lightningSDKStatus === 'failed' ? t('lightning.initializationFailed') : undefined)
  );

  return (
    <View fitContent onClose={isSending || isMobile ? undefined : onClose}>
      <Header variant="fullscreen" title={t('lightning.send.title')} mobileBackButton={isMobile && !isSending} onBack={onClose} />
      <ViewHeader className="hide-on-small" title={t('lightning.send.title')} />
      {success ? (
        <>
          <SuccessStep onAddContact={onClose} onDone={onClose} />
          <ViewButtons><Button primary onClick={onClose}>{t('button.done')}</Button></ViewButtons>
        </>
      ) : paymentInput && !error ? (
        <ReviewStep
          paymentInput={paymentInput}
          backToPaymentInput={backToPaymentInput}
          onSendingChange={setIsSending}
          onSuccess={onSuccess}
        />
      ) : message ? (
        <>
          <ViewContent>
            <Message type="warning">{message}</Message>
          </ViewContent>
          <ViewButtons><Button secondary onClick={onClose}>{t('dialog.cancel')}</Button></ViewButtons>
        </>
      ) : (
        <Spinner text={isLightningReady ? t('loading') : t('lightning.initializing')} />
      )}
      {isSending && <UseDisableBackButton />}
    </View>
  );
};

export const LightningPaymentRequest = () => {
  const available = isLightningFeatureAvailable();
  const request = useSync(
    available ? getLightningURI : null,
    available ? subscribeLightningURI : null,
    value => value.revision,
  );
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const handledRevision = useRef(0);
  const [pathname] = useLocation();
  // Keep existing transaction and setup screens usable until the user leaves them.
  const busy = (
    /^\/lightning\/(send|activate|topup|close-withdraw-funds|claim-top-up|deactivate)\/?$/.test(pathname)
    || /^\/account\/[^/]+\/send(?:\/|$)/.test(pathname)
    || pathname === '/market/swap'
  );

  useEffect(() => {
    if (activeInput !== null || busy || !request || request.input === null || request.revision <= handledRevision.current) {
      return;
    }
    handledRevision.current = request.revision;
    setActiveInput(request.input);
    postClearLightningURI(request.revision).catch(console.error);
  }, [activeInput, busy, request]);

  const dismiss = useCallback(() => setActiveInput(null), []);

  if (activeInput === null) {
    return null;
  }
  return (
    <View fullscreen scrollableContent withMobileSafetyMargin width="720px">
      <LightningTestnetGuard active onCancel={dismiss}>
        <PaymentRequest input={activeInput} onClose={dismiss} />
      </LightningTestnetGuard>
    </View>
  );
};
