/**
 * Copyright 2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Input } from '@/components/forms';
import { useDarkmode } from '@/hooks/darkmode';
import { Edit, EditLight, Save, SaveLight } from '@/components/icon/icon';

import style from './transaction.module.css';

type Props = {
  accountCode: accountApi.AccountCode;
  internalID: string;
  // Contains the existing note.
  note: string;
  outputIndex?: number;
}

export const Note = ({
  accountCode,
  note,
  internalID,
  outputIndex,
}: Props) => {
  const { isDarkMode } = useDarkmode();
  const { t } = useTranslation();
  const [newNote, setNewNote] = useState<string>(note);
  const [editMode, setEditMode] = useState<boolean>(!note);
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editMode]);

  const handleNoteInput = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    setNewNote(target.value);
  };

  const handleEdit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (editMode && note !== newNote) {
      accountApi.postNotesTx(accountCode, {
        internalTxID: outputIndex !== undefined ? `${internalID}:${outputIndex}` : internalID,
        note: newNote,
      }).catch(console.error);
    }
    setEditMode(!editMode);
  };

  return (
    <form onSubmit={handleEdit} className={style.detailInput}>
      <label htmlFor="note">{t('note.title')}</label>
      <Input
        align="right"
        autoFocus={editMode}
        className={style.textOnlyInput}
        readOnly={!editMode}
        type="text"
        id="note"
        transparent
        placeholder={t('note.input.placeholder')}
        value={newNote}
        maxLength={256}
        onInput={handleNoteInput}
        ref={inputRef}/>
      <button
        className={style.editButton}
        onClick={handleEdit}
        title={t(`transaction.note.${editMode ? 'save' : 'edit'}`)}
        type="button"
        ref={editButtonRef}>
        {
          editMode
            ? isDarkMode ? <SaveLight /> : <Save />
            : isDarkMode ? <EditLight /> : <Edit />
        }
      </button>
    </form>
  );
};
