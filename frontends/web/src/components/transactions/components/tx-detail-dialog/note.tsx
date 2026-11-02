// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileLayout } from '@/hooks/mobile-layout';
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
  const isMobile = useMobileLayout();
  const [newNote, setNewNote] = useState<string>(note);
  const savedNote = useRef<string | undefined>(note);
  const pendingNote = useRef<string>();
  const saveInProgress = useRef(false);
  const [error, setError] = useState<string>();
  const mounted = useMountedRef();

  const handleNoteInput = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    setNewNote(target.value);
    setError(undefined);
  };

  const savePendingNotes = async () => {
    saveInProgress.current = true;
    // Keep writes in order and retain only the latest edit submitted while saving.
    while (pendingNote.current !== undefined) {
      const noteToSave = pendingNote.current;
      pendingNote.current = undefined;
      if (noteToSave === savedNote.current) {
        continue;
      }
      if (mounted.current) {
        setError(undefined);
      }
      try {
        await onSave(noteToSave);
        savedNote.current = noteToSave;
      } catch (err: unknown) {
        // A failed request may still have changed the backend's note state.
        savedNote.current = undefined;
        if (mounted.current && pendingNote.current === undefined) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    saveInProgress.current = false;
  };

  const handleBlur = () => {
    pendingNote.current = newNote;
    if (!saveInProgress.current) {
      savePendingNotes();
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
