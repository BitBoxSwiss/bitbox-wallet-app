// SPDX-License-Identifier: Apache-2.0

import { i18n } from '@/i18n/i18n';
import { convertDateToLocaleString } from '@/utils/date';
import { Radio } from '@/components/forms';
import { Backup } from '@/api/backup';
import style from './backups.module.css';

type Props = {
  backup: Backup;
  disabled?: boolean;
  handleChange?: (value: string) => void;
  onFocus?: (event: React.SyntheticEvent) => void;
  radio: boolean;
  selectedBackup?: string;
};

export const BackupsListItem = ({
  backup,
  disabled,
  handleChange,
  onFocus,
  radio,
  selectedBackup,
}: Props) => {
  let date = '';
  if (backup.date && backup.date !== '') {
    date = convertDateToLocaleString(backup.date, i18n.language);
  } else {
    date = 'unknown';
  }
  return radio ? (
    <Radio
      disabled={!!disabled}
      checked={selectedBackup === backup.id}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        handleChange && handleChange(event.target.value);
      }}
      id={backup.id}
      label={backup.name && backup.name !== '' ? backup.name : backup.id}
      value={backup.id}
      onFocus={onFocus}
      className={style.backupItem}>
      <span className="text-small text-gray">{date}</span>
      <span className="text-small text-gray">ID: {backup.id}</span>
    </Radio>
  ) : (
    <div>
      <div className="text-medium m-bottom-quarter">{backup.name}</div>
      <div className={style.backupID}>ID: {backup.id}</div>
      <div className="text-small text-gray">{date}</div>
    </div>
  );
};
