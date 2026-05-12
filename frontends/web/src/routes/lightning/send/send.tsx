// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Status } from '@/components/status/status';
import { ConfirmStep } from './components/confirm-step';
import { EditInvoiceStep } from './components/edit-invoice-step';
import { SelectInvoiceStep } from './components/select-invoice-step';
import { SendingSpinner } from './components/sending-spinner';
import { SuccessStep } from './components/success-step';
import { LightningSendProvider, useLightningSendContext } from './lightning-send-context';

const SendContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sendError, step } = useLightningSendContext();

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
          <Status dismissibleKey="" type="warning" hidden={!sendError}>
            {sendError}
          </Status>
          {step === 'select-invoice' && <SelectInvoiceStep />}
          {step === 'edit-invoice' && <EditInvoiceStep />}
          {step === 'preparing' && <Spinner text={t('loading')} />}
          {step === 'confirm' && <ConfirmStep />}
          {step === 'sending' && <SendingSpinner />}
          {step === 'success' && <SuccessStep />}
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

export const Send = () => (
  <LightningSendProvider>
    <SendContent />
  </LightningSendProvider>
);
