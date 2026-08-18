// SPDX-License-Identifier: Apache-2.0

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TAccount } from '@/api/account';
import { Button } from '@/components/forms';
import { EditActive, PasteActive } from '@/components/icon';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { isBitcoinOnly } from '@/routes/account/utils';
import { ReceiverAddressInputField } from '@/routes/account/send/components/inputs/receiver-address-input-field';
import { ScanQR } from '@/routes/account/send/components/inputs/scan-qr';
import { triggerLongHapticFeedback } from '@/utils/transport-mobile';
import styles from './select-payment-input-step.module.css';

type TProps = {
  activeAccounts: TAccount[];
  inputError?: string;
  onCancel: () => void;
  onSubmit: (input: string) => Promise<boolean>;
  onClearError: () => void;
};

type TPaymentInputMode = 'input' | 'scan';

const TRANSITION_MS = 300;

export const SelectPaymentInputStep = ({
  activeAccounts,
  inputError,
  onCancel,
  onSubmit,
  onClearError,
}: TProps) => {
  const { t } = useTranslation();
  const [manualValue, setManualValue] = useState('');
  const [mode, setMode] = useState<TPaymentInputMode>('scan');
  const [inputClosing, setInputClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendToSelfAccounts = useMemo(
    () => activeAccounts
      .filter(account => isBitcoinOnly(account.coinCode) && (
        account.keystore.connected || account.keystore.watchonly
      ))
      .sort((accountA, accountB) => (
        Number(accountB.keystore.connected) - Number(accountA.keystore.connected)
      )),
    [activeAccounts]
  );

  useEffect(() => () => {
    if (transitionTimer.current !== null) {
      clearTimeout(transitionTimer.current);
    }
  }, []);

  const clearTransitionTimer = () => {
    if (transitionTimer.current !== null) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  };

  const showInput = () => {
    clearTransitionTimer();
    setInputClosing(false);
    setSubmitting(false);
    onClearError();
    setMode('input');
  };

  const showScanner = () => {
    clearTransitionTimer();
    setSubmitting(false);
    onClearError();
    setInputClosing(true);
    transitionTimer.current = setTimeout(() => {
      setMode('scan');
      setInputClosing(false);
      transitionTimer.current = null;
    }, TRANSITION_MS);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const accepted = await onSubmit(value);
      if (accepted) {
        triggerLongHapticFeedback();
      } else {
        setSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setSubmitting(false);
    }
  };

  const handleScanResult = async (result: string) => {
    const accepted = await onSubmit(result);
    if (accepted) {
      triggerLongHapticFeedback();
    }
    return false;
  };

  const handlePaste = async () => {
    if (submitting || !navigator.clipboard?.readText) {
      return;
    }
    setSubmitting(true);
    onClearError();
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) {
        setSubmitting(false);
        return;
      }
      const accepted = await onSubmit(value);
      if (accepted) {
        triggerLongHapticFeedback();
      } else {
        setSubmitting(false);
      }
    } catch (error) {
      console.error(error);
      setSubmitting(false);
    }
  };

  if (mode === 'scan') {
    return (
      <ScanQR
        fullscreen
        onResult={handleScanResult}
        onClose={onCancel}
        instruction={t('lightning.send.scanInstruction')}
      >
        {requestClose => (
          <div className={styles.scanControls}>
            {inputError && (
              <div className={styles.scanError}>
                <Message type="warning" className={styles.scanErrorMessage}>
                  {inputError}
                </Message>
              </div>
            )}
            <div className={styles.scanActions}>
              <Button
                transparent
                className={styles.scanActionButton}
                disabled={submitting}
                onClick={() => requestClose(showInput)}>
                <EditActive aria-hidden alt="" />
                <span>{t('lightning.send.enterInvoice')}</span>
              </Button>
              <Button
                transparent
                className={styles.scanActionButton}
                disabled={submitting}
                onClick={handlePaste}>
                <PasteActive aria-hidden alt="" />
                <span>{t('lightning.send.pasteClipboard')}</span>
              </Button>
            </div>
          </div>
        )}
      </ScanQR>
    );
  }

  return (
    <div className={`${styles.inputView || ''} ${inputClosing ? styles.inputViewClosing || '' : ''}`}>
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <View>
          <ViewContent>
            {inputError && (
              <Message type="warning">
                {inputError}
              </Message>
            )}
            <ReceiverAddressInputField
              accounts={sendToSelfAccounts}
              autoFocus
              groupAccountsByKeystore
              inputLabel={t('lightning.send.invoice.label')}
              inputPlaceholder={t('lightning.send.invoice.placeholder')}
              onInputChange={setManualValue}
              onScanQR={showScanner}
              recipientAddress={manualValue}
              requireSendToSelfSupport={false}
            />
          </ViewContent>
          <ViewButtons>
            <Button primary type="submit" disabled={submitting || !manualValue.trim()}>
              {t('button.continue')}
            </Button>
          </ViewButtons>
        </View>
      </form>
    </div>
  );
};
