import { useTranslation } from 'react-i18next';
import { Input } from '../../../../../components/forms';
import style from '../../send.module.css';

type TProps = {
    onNoteChange: (event: Event) => void;
    note: string;
}

export const NoteInput = ({ onNoteChange, note }: TProps) => {
  const { t } = useTranslation();
  return (
    <Input
      label={t('note.title')}
      labelSection={
        <span className={style.labelDescription}>
          {t('note.input.description')}
        </span>
      }
      id="note"
      onInput={onNoteChange}
      value={note}
      placeholder={t('note.input.placeholder')}
    />
  );
};