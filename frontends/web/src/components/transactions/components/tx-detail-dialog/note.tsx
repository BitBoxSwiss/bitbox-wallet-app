// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { useMediaQuery } from '@/hooks/mediaquery';
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
  const isMobile = useMediaQuery('(max-width: 768px)');
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
      <label className={`${detailsDialogStyles.label || ''} ${detailsDialogStyles.noteLabel || ''}`} htmlFor="note">{t('note.title')}</label>
      <Input
        autoFocus={!isMobile}
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
