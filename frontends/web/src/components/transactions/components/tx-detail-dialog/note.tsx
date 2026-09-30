// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/hooks/mediaquery';
import { useMountedRef } from '@/hooks/mount';
import { Input } from '@/components/forms';
import detailsDialogStyles from './tx-detail-dialog.module.css';

type TProps = {
  onSave: (note: string) => Promise<unknown>;
  // Contains the existing note.
  note: string;
};

export const Note = ({ note, onSave }: TProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [newNote, setNewNote] = useState<string>(note);
  const [savedNote, setSavedNote] = useState<string>(note);
  const [error, setError] = useState<string>();
  const mounted = useMountedRef();

  const handleNoteInput = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    setNewNote(target.value);
    setError(undefined);
  };

  const handleBlur = () => {
    if (savedNote !== newNote) {
      setError(undefined);
      onSave(newNote).then(() => {
        if (mounted.current) {
          setSavedNote(newNote);
        }
      }).catch((err: unknown) => {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
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
        aria-describedby={error ? 'note-error' : undefined}
        transparent
        placeholder={t('note.input.placeholder')}
        value={newNote}
        maxLength={256}
        onInput={handleNoteInput}
        onBlur={handleBlur}/>
      {error && (
        <p id="note-error" role="alert" className={detailsDialogStyles.noteError}>
          {t('unknownError', { errorMessage: error })}
        </p>
      )}
    </form>
  );
};
