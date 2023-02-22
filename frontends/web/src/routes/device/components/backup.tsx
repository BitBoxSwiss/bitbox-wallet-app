/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import React, { Component } from 'react';
import { translate, TranslateProps } from '../../../decorators/translate';
import { convertDateToLocaleString } from '../../../utils/date';
import { Radio } from '../../../components/forms';
import style from './backups.module.css';

interface BackupsListItemProps {
    disabled?: boolean;
    backup: Backup;
    selectedBackup?: string;
    handleChange?: (value: string) => void;
    onFocus?: (event: React.SyntheticEvent) => void;
    radio: boolean;
}

export interface Backup {
    id: string;
    date: string;
    name: string;
}

type Props = BackupsListItemProps & TranslateProps;

class BackupsListItem extends Component<Props> {
  public render() {
    const { disabled, backup, selectedBackup, handleChange, onFocus, radio } = this.props;
    let date = '';
    if (backup.date && backup.date !== '') {
      date = convertDateToLocaleString(backup.date, this.props.i18n.language);
    } else {
      date = 'unknown';
    }
    return (
      radio ?
        <Radio
          disabled={!!disabled}
          checked={selectedBackup === backup.id}
          onChange={(event: React.SyntheticEvent) => handleChange && handleChange((event.target as HTMLInputElement).value)}
          id={backup.id}
          label={backup.name && backup.name !== '' ? backup.name : backup.id}
          value={backup.id}
          onFocus={onFocus}
          className={style.backupItem}>
          <span className="text-small text-gray">{date}</span>
          <span className="text-small text-gray">ID: {backup.id}</span>
        </Radio> :
        <div>
          <div className="text-medium m-bottom-quarter">{backup.name}</div>
          <div className={style.backupID}>ID: {backup.id}</div>
          <div className="text-small text-gray">{date}</div>
        </div>
    );
  }
}

const TranslatedBackupsListItem = translate()(BackupsListItem);
export { TranslatedBackupsListItem as BackupsListItem };
