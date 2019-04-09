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
import { BackupsV2 } from '../../../components/devices/bitbox02/backups';
import { apiPost } from '../../../utils/request';
import { Dialog } from '../../../components/dialog/dialog';

@translate()
export default class ManageBackups extends Component {
    constructor(props) {
        super(props);
        this.state = {
            sdCardInserted: this.props.sdCardInserted === 'true',
            activeDialog: !this.state.sdCardInserted,
        };
    }
    hasDevice = () => {
        return !!this.props.devices[this.props.deviceID];
    }

    componentWillMount() {
        if (!this.hasDevice()) {
            route('/', true);
        }
    }

    backButton = () => {
        return (
            <ButtonLink
                secondary
                href={`/device/${this.props.deviceID}`}>
                {this.props.t('button.back')}
            </ButtonLink>
        );
    }

    listBackups  = () => {
        switch (this.props.devices[this.props.deviceID]) {
        case 'bitbox':
            return (
                <Backups
                    deviceID={this.props.deviceID}
                    showCreate={true}
                    showRestore={false}>
                    {this.backButton()}
                </Backups>
            );
        case 'bitbox02':
            return (
                this.state.sdCardInserted ?
                    <BackupsV2
                        deviceID={this.props.deviceID}
                        showRestore={false}>
                        {this.backButton()}
                    </BackupsV2> :
                    <div>
                        {this.insertBB02SDCard()}
                        {
                            this.state.activeDialog &&
                            <Dialog>
                                <div>
                                    <p style="text-align:center; min-height: 3rem;">Please Insert SD Card</p>
                                    <div className={['buttons', 'flex', 'flex-row', 'flex-start'].join(' ')}>
                                        {this.backButton()}
                                    </div>
                                </div>
                            </Dialog>
                        }
                    </div>
            );
        default:
            return;
        }
    }

    insertBB02SDCard = () => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/insert-sdcard').then(({ success }) => {
            if (success) {
                this.setState({ sdCardInserted: true });
            }
        });
    }

    render({ t }, { }) {
        if (!this.hasDevice()) {
            return null;
        }
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('backup.title')}</h2>} />
                    <div className={styles.manageBackups}>
                        {this.listBackups()}
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
