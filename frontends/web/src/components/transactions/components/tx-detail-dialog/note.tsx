// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Input } from '@/components/forms';
import detailsDialogStyles from './tx-detail-dialog.module.css';

type Props = {
  accountCode: accountApi.AccountCode;
  internalID: string;
  // Contains the existing note.
  note: string;
};

export const Note = ({ accountCode, note, internalID }: Props) => {
  const { t } = useTranslation();
  const [newNote, setNewNote] = useState<string>(note);
  const [savedNote, setSavedNote] = useState<string>(note);

  const handleNoteInput = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    setNewNote(target.value);
  };

  const handleBlur = () => {
    if (savedNote !== newNote) {
      accountApi.postNotesTx(accountCode, {
        internalTxID: internalID,
        note: newNote,
      }).then(() => {
        setSavedNote(newNote);
      }).catch(console.error);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleBlur();
  };

  return (
    <form onSubmit={handleSubmit} className={detailsDialogStyles.noteContainer}>
      <label className={detailsDialogStyles.label} htmlFor="note">{t('note.title')}</label>
      <Input
        autoFocus
        align="right"
        className={detailsDialogStyles.note}
        type="text"
        id="note"
        transparent
        placeholder={t('note.input.placeholder')}
        value={newNote}
        maxLength={256}
        onInput={handleNoteInput}
        onBlur={handleBlur}/>
    </form>
  );
};
