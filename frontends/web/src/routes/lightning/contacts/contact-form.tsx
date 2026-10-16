// SPDX-License-Identifier: Apache-2.0

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postDeleteLightningContact, postLightningContact, TLightningContact } from '@/api/lightning';
import { toLightningErrorMessage, TSdkError } from '@/api/lightning-errors';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Input } from '@/components/forms';
import { Checked } from '@/components/icon';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { UseBackButton } from '@/hooks/backbutton';
import { useMountedRef } from '@/hooks/mount';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import styles from './contacts.module.css';

type TProps = {
  contact?: TLightningContact;
  initialAddress?: string;
  onCancel: () => void;
  onDone: () => void;
  onSend?: (address: string) => void;
};

export const ContactForm = ({ contact, initialAddress = '', onCancel, onDone, onSend }: TProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const [savedContact, setSavedContact] = useState(contact);
  const [name, setName] = useState(contact?.name ?? '');
  const [address, setAddress] = useState(contact?.address ?? initialAddress);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = contact !== undefined;
  const changed = name !== savedContact?.name || address !== savedContact?.address;
  const busy = saving || deleting;
  const added = saved && !editing;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || added || !changed || !address.trim()) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const result = await postLightningContact({ id: savedContact?.id, name, address });
      if (!result.success) {
        throw new TSdkError(t('lightning.contacts.saveError'), result.errorCode);
      }
      if (!mounted.current) {
        return;
      }
      setSavedContact(result.data);
      setName(result.data.name);
      setAddress(result.data.address);
      setSaved(true);
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof TSdkError ? toLightningErrorMessage(t, err) : t('lightning.contacts.saveError'));
      }
    } finally {
      if (mounted.current) {
        setSaving(false);
      }
    }
  };

  const deleteContact = async () => {
    if (!savedContact || busy || changed) {
      return;
    }
    setDeleting(true);
    setError(undefined);
    try {
      const result = await postDeleteLightningContact(savedContact.id);
      if (!result.success) {
        throw new TSdkError(t('lightning.contacts.deleteError'), result.errorCode);
      }
      if (mounted.current) {
        onDone();
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof TSdkError ? toLightningErrorMessage(t, err) : t('lightning.contacts.deleteError'));
      }
    } finally {
      if (mounted.current) {
        setDeleting(false);
        setConfirmDelete(false);
      }
    }
  };

  return (
    <>
      {!editing && (
        <UseBackButton handler={() => {
          if (!busy) {
            if (added) {
              onDone();
            } else {
              onCancel();
            }
          }
          return false;
        }} />
      )}
      <form className={styles.form} onSubmit={save}>
        <View>
          <ViewContent>
            {error && <Message type="warning">{error}</Message>}
            <Input
              id="contactName"
              label={<>{t('lightning.contacts.name')} <span className={styles.optional}>{t('lightning.contacts.optional')}</span></>}
              placeholder={t('lightning.contacts.namePlaceholder')}
              value={name}
              disabled={busy || added}
              onInput={event => {
                setName(event.currentTarget.value);
                setSaved(false);
                setError(undefined);
              }}
            />
            <Input
              id="contactAddress"
              label={t('lightning.settings.setLightningAddress')}
              placeholder={t('lightning.contacts.addressPlaceholder')}
              value={address}
              disabled={busy || added}
              inputMode="email"
              onInput={event => {
                setAddress(event.currentTarget.value);
                setSaved(false);
                setError(undefined);
              }}
            />
            {saved && <p className={styles.saved}><Checked aria-hidden alt="" />{t('lightning.contacts.saved')}</p>}
            {editing && (
              <SettingsItem
                settingName={<span className={styles.danger}>{t('lightning.contacts.delete')}</span>}
                disabled={busy || changed}
                onClick={() => setConfirmDelete(true)}
              />
            )}
          </ViewContent>
          <ViewButtons>
            {added ? <Button primary onClick={onDone}>{t('button.done')}</Button> : (
              <>
                <Button primary type="submit" disabled={busy || !changed || !address.trim()}>{t('button.save')}</Button>
                {editing ? (
                  <Button primary disabled={busy || changed} onClick={() => savedContact && onSend?.(savedContact.address)}>
                    {t('generic.send')}
                  </Button>
                ) : <Button secondary disabled={busy} onClick={onCancel}>{t('dialog.cancel')}</Button>}
              </>
            )}
          </ViewButtons>
        </View>
      </form>
      <Dialog open={confirmDelete} title={t('lightning.contacts.delete')} onClose={busy ? undefined : () => setConfirmDelete(false)}>
        <p>{t('lightning.contacts.deleteConfirmation')}</p>
        <DialogButtons>
          <Button danger disabled={busy} onClick={deleteContact}>{t('lightning.contacts.deleteAction')}</Button>
          <Button secondary disabled={busy} onClick={() => setConfirmDelete(false)}>{t('dialog.cancel')}</Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};
