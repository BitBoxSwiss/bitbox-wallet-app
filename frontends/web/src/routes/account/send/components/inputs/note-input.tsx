/**
 * Copyright 2023 Shift Crypto AG
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

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/forms';
import { useMediaQuery } from '@/hooks/mediaquery';
import style from './note-input.module.css';

type TProps = {
  onNoteChange: (note: string) => void;
  note: string;
};

export const NoteInput = ({ onNoteChange, note }: TProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { t } = useTranslation();
  return (
    <Input
      label={t('note.title')}
      labelSection={
        <span className={style.labelDescription}>
          {t('note.input.description')}
        </span>
      }
      autoFocus={!isMobile}
      id="note"
      onInput={(e: ChangeEvent<HTMLInputElement>) => onNoteChange(e.target.value)}
      value={note}
      placeholder={t('note.input.placeholder')}
    />
  );
};
