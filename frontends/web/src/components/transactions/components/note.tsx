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

import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Input } from '@/components/forms';
import style from './details.module.css';
import detailsDialogStyles from './details-dialog-new.module.css';

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

  return (
    <div className={style.detailInput}>
      <label className={detailsDialogStyles.label} htmlFor="note">{t('note.title')}</label>
      <Input
        align="right"
        className={style.textOnlyInput}
        type="text"
        id="note"
        transparent
        placeholder={t('note.input.placeholder')}
        value={newNote}
        maxLength={256}
        onInput={handleNoteInput}
        onBlur={handleBlur}/>
    </div>
  );
};
