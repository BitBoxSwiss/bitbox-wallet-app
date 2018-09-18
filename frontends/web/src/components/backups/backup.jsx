/**
 * Copyright 2018 Shift Devices AG
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

import { h } from 'preact';
import i18n from '../../i18n/i18n';
import { Radio } from '../forms';

/** @param {{ backup: any; selectedBackup: any; handleChange: any; onFocus: any; key: any }} props */
export default function BackupsListItem({
    backup,
    selectedBackup,
    handleChange,
    onFocus,
}) {
    let date = '';
    if (backup.date && backup.date !== '') {
        const months = i18n.t('months');
        const days = i18n.t('days');
        const dt = new Date(backup.date);
        date = `${days[dt.getDay()]}, ${dt.getDate()}${i18n.t('dayPeriod')} ${months[dt.getMonth()]} ${dt.getFullYear()}, ${i18n.t('atTime')} ${dt.getHours()}:${(dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes()}`;
    } else {
        date = 'unknown';
    }
    let name = backup.name && backup.name !== '' ? backup.name : backup.id;
    return (
        <Radio
            checked={selectedBackup === backup.id}
            onChange={handleChange}
            id={backup.id}
            label={name}
            value={backup.id}
            onFocus={onFocus}
            sizeMedium>
            <span className="text-small text-gray">{date}</span>
        </Radio>
    );
}
