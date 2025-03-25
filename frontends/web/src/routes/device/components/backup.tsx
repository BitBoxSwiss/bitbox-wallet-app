/**
 * Copyright 2018 Shift Devices AG
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
      className={style.backupItem}
    >
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
