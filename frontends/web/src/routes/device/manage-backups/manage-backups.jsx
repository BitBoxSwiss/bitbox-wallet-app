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
import { ButtonLink, Button } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Backups } from '../../../components/backups/backups';
import { Header } from '../../../components/layout';
import * as styles from './manage-backups.css';
import { BackupsV2 } from '../../../components/devices/bitbox02/backups';
import { apiGet } from '../../../utils/request';
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
                        showCreate={true}
                        showRestore={false}
                        showRadio={false}>
                        {this.backButton()}
                    </BackupsV2> : (
                        <div>
                            {
                                this.state.activeDialog && (
                                    <Dialog>
                                        <div>
                                            <p style="text-align:center; min-height: 3rem;">{this.props.t('backup.insert')}</p>
                                            <div className={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
                                                {this.backButton()}
                                                <Button
                                                    primary
                                                    onClick={this.checkBB02SDCard}>
                                                    {this.props.t('button.ok')}
                                                </Button>
                                            </div>
                                        </div>
                                    </Dialog>
                                )
                            }
                        </div>
                    )
            );
        default:
            return;
        }
    }

    checkBB02SDCard = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/check-sdcard').then(inserted => this.setState({ sdCardInserted: inserted }));
    }

    renderGuide = t => {
        switch (this.props.devices[this.props.deviceID]) {
        case 'bitbox':
            return (
                <Guide>
                    <Entry key="guide.backups.whatIsABackup" entry={t('guide.backups.whatIsABackup')} />
                    <Entry key="guide.backups.encrypt" entry={t('guide.backups.encrypt')} />
                    <Entry key="guide.backups.check" entry={t('guide.backups.check')} />
                    <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften')} />
                </Guide>
            );
        case 'bitbox02':
            return (
                <Guide>
                    <Entry key="guide.backupsBB02.whatIsABackup" entry={t('guide.backupsBB02.whatIsABackup')} />
                    <Entry key="guide.backupsBB02.encrypt" entry={t('guide.backupsBB02.encrypt')} shown={true} />
                    <Entry key="guide.backupsBB02.check" entry={t('guide.backupsBB02.check')} />
                    <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften')} />
                </Guide>
            );
        default:
            return null;
        }
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
                        <div className="subHeaderContainer" style="justify-content: center; margin: 0;">
                            <div className="subHeader">
                                <h3 className="text-center">Your Backups</h3>
                            </div>
                        </div>
                        {this.listBackups()}
                    </div>
                </div>
                {this.renderGuide(t)}
            </div>
        );
    }
}
