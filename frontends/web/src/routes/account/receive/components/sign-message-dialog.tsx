// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Button, Input, Field, Label } from '@/components/forms';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Message } from '@/components/message/message';
import { CopyableInput } from '@/components/copy/Copy';
import { PointToBitBox02 } from '@/components/icon';
import style from './sign-message-dialog.module.css';

type TProps = {
  open: boolean;
  onClose: () => void;
  address: accountApi.TReceiveAddress;
  accountCode: accountApi.AccountCode;
};

type TSigningState = 'input' | 'signing' | 'result';

type TSignatureResult = {
  address: string;
  message: string;
  signature: string;
};

export const SignMessageDialog = ({
  open,
  onClose,
  address,
  accountCode,
}: TProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<TSigningState>('input');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TSignatureResult | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setMessage('');
      setState('input');
      setError(null);
      setResult(null);
    }
  }, [open]);

  const handleSign = async () => {
    setError(null);

    if (!message.trim()) {
      setError(t('receive.signMessage.emptyMessage'));
      return;
    }

    setState('signing');

    try {
      const response = await accountApi.signMessage(
        accountCode,
        address.addressID,
        message,
      );

      if (response.success) {
        setResult({
          address: response.address,
          message: message,
          signature: response.signature,
        });
        setState('result');
      } else {
        if (response.errorCode === 'userAbort') {
          onClose();
          return;
        } else if (response.errorCode === 'wrongKeystore') {
          setError(t('receive.signMessage.wrongKeystore'));
          setState('input');
        } else {
          setError(response.errorMessage || t('receive.signMessage.error'));
          setState('input');
        }
      }
    } catch (err) {
      setError(t('receive.signMessage.error'));
      setState('input');
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderInput = () => (
    <>
      <Field>
        <Label>{t('receive.signMessage.addressLabel')}</Label>
        <CopyableInput
          value={address.address}
          flexibleHeight
        />
      </Field>
      <Field>
        <Label>{t('receive.signMessage.messageLabel')}</Label>
        <Input
          id="sign-message-input"
          value={message}
          onInput={(e) => setMessage(e.target.value)}
          placeholder={t('receive.signMessage.messagePlaceholder')}
          autoFocus
        />
      </Field>
      {error && (
        <Message type="error">
          {error}
        </Message>
      )}
      <DialogButtons>
        <Button
          primary
          onClick={handleSign}
          disabled={!message.trim()}
        >
          {t('receive.signMessage.signButton')}
        </Button>
        <Button
          secondary
          onClick={handleClose}
        >
          {t('button.back')}
        </Button>
      </DialogButtons>
    </>
  );

  const renderSigning = () => (
    <>
      <p className="text-center">{t('receive.signMessage.signing')}</p>
      <Field>
        <Label>{t('receive.signMessage.addressLabel')}</Label>
        <CopyableInput
          value={address.address}
          flexibleHeight
        />
      </Field>
      <Field>
        <Label>{t('receive.signMessage.messageLabel')}</Label>
        <div className={style.messageDisplay}>
          {message}
        </div>
      </Field>
      <PointToBitBox02 />
    </>
  );

  const renderResult = () => (
    <>
      <p className="text-center">{t('receive.signMessage.resultDescription')}</p>
      <Field>
        <Label>{t('receive.signMessage.addressLabel')}</Label>
        <CopyableInput
          value={result?.address || ''}
          flexibleHeight
        />
      </Field>
      <Field>
        <Label>{t('receive.signMessage.messageLabel')}</Label>
        <CopyableInput
          value={result?.message || ''}
          flexibleHeight
        />
      </Field>
      <Field>
        <Label>{t('receive.signMessage.signatureLabel')}</Label>
        <CopyableInput
          value={result?.signature || ''}
          flexibleHeight
        />
      </Field>
      <DialogButtons>
        <Button primary onClick={handleClose}>
          {t('button.done')}
        </Button>
      </DialogButtons>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={state !== 'signing' ? handleClose : undefined}
      title={t('receive.signMessage.title')}
      medium
    >
      <div className={style.container}>
        {state === 'input' && renderInput()}
        {state === 'signing' && renderSigning()}
        {state === 'result' && renderResult()}
      </div>
    </Dialog>
  );
};
