// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/forms';
import { useMobileLayout } from '@/hooks/mobile-layout';
import style from './note-input.module.css';

type TProps = {
  onNoteChange: (note: string) => void;
  note: string;
};

export const NoteInput = ({ onNoteChange, note }: TProps) => {
  const isMobile = useMobileLayout();
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
