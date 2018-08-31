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
import i18n from '../../../i18n/i18n';
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import Backups from '../../../components/backups/backups';

export default function ManageBackups({
    deviceID,
}) {
    return (
        <div class="contentWithGuide">
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{i18n.t('backup.title')}</h2>
                    </div>
                </div>
                <Backups
                    deviceID={deviceID}
                    showCreate={true}>
                    <ButtonLink
                        secondary
                        href={`/device/${deviceID}`}
                        style="position: absolute; right: 0;">
                        {i18n.t('button.back')}
                    </ButtonLink>
                </Backups>
            </div>
            <Guide screen="backups" />
        </div>
    );
}
