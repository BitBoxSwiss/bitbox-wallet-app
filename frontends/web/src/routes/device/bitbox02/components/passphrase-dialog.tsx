// SPDX-License-Identifier: Apache-2.0

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitHostPassphrase } from '@/api/bitbox02';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Input } from '@/components/forms';
import { Message } from '@/components/message/message';
import { useMountedRef } from '@/hooks/mount';

type TProps = {
  deviceID: string;
  id: string;
};

export const PassphraseDialog = ({ deviceID, id }: TProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (value: string | null) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await submitHostPassphrase(deviceID, id, value);
      if (mounted.current) {
        if (response.success) {
          setPassphrase('');
        } else {
          setError(response.errorCode
            ? t(`bitbox02Wizard.passphrase.error.${response.errorCode}`)
            : t('genericError'));
        }
      }
    } catch {
      if (mounted.current) {
        setError(t('genericError'));
      }
    } finally {
      if (mounted.current) {
        setSubmitting(false);
      }
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(passphrase);
  };

  return (
    <Dialog
      open
      noSidebarOffset
      title={t('bitbox02Wizard.passphrase.dialogTitle')}
      onClose={submitting ? undefined : () => submit(null)}>
      <form onSubmit={onSubmit}>
        <Input
          type="password"
          autoFocus
          aria-label={t('bitbox02Wizard.passphrase.dialogTitle')}
          value={passphrase}
          disabled={submitting}
          onChange={event => {
            setPassphrase(event.target.value);
            setError('');
          }} />
        {error && <Message type="error">{error}</Message>}
        <DialogButtons>
          <Button primary type="submit" disabled={submitting}>
            {t('dialog.confirm')}
          </Button>
        </DialogButtons>
      </form>
    </Dialog>
  );
};
