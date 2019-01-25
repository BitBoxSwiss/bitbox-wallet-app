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
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Backups } from '../../../components/backups/backups';
import { Header } from '../../../components/layout';
import * as styles from './manage-backups.css';

@translate()
export default class ManageBackups extends Component {
    hasDevice = () => {
        return !!this.props.devices[this.props.deviceID];
    }

    componentWillMount() {
        if (!this.hasDevice()) {
            route('/', true);
        }
    }

    render({ t, deviceID }, { }) {
        if (!this.hasDevice()) {
            return null;
        }
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('backup.title')}</h2>} />
                    <div className={styles.manageBackups}>
                        <Backups
                            deviceID={deviceID}
                            showCreate={true}
                            showRestore={false}>
                            <ButtonLink
                                secondary
                                href={`/device/${deviceID}`}>
                                {t('button.back')}
                            </ButtonLink>
                        </Backups>
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.backups.whatIsABackup" entry={t('guide.backups.whatIsABackup')} />
                    <Entry key="guide.backups.encrypt" entry={t('guide.backups.encrypt')} />
                    <Entry key="guide.backups.check" entry={t('guide.backups.check')} />
                    <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften')} />
                </Guide>
            </div>
        );
    }
}
