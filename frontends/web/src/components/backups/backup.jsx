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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Radio } from '../forms';

@translate() // Leaving this here to ensure that the component re-renders when the language changes.
export default class BackupsListItem extends Component {
    render({
        backup,
        selectedBackup,
        handleChange,
        onFocus,
    }, { }) {
        let date = '';
        if (backup.date && backup.date !== '') {
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            };
            date = new Date(backup.date).toLocaleString(this.context.i18n.language, options);
        } else {
            date = 'unknown';
        }
        let name = backup.name && backup.name !== '' ? backup.name : backup.id;
        return (
            <Radio
                checked={selectedBackup === backup.id}
                onChange={event => handleChange(event.target.value)}
                id={backup.id}
                label={name}
                value={backup.id}
                onFocus={onFocus}
                sizeMedium>
                <span className="text-small text-gray">{date}</span>
            </Radio>
        );
    }
}
