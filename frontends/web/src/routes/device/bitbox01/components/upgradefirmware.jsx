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

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import { Dialog, DialogButtons } from '../../../../components/dialog/dialog';
import { WaitDialog } from '../../../../components/wait-dialog/wait-dialog';
import { apiGet, apiPost } from '../../../../utils/request';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';

class UpgradeFirmware extends Component {
    state = {
        unlocked: false,
        newVersion: '',
        isConfirming: false,
        activeDialog: false,
    }

    upgradeFirmware = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/unlock-bootloader').then((success) => {
            this.setState({
                unlocked: success,
                isConfirming: success,
            });
        }).catch(() => {
            this.setState({
                isConfirming: false,
            });
        });
    };

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
            this.setState({ newVersion: version.replace('v', '') });
        });
    }

    abort = () => {
        this.setState({ activeDialog: false });
    }

    render({
        t,
        currentVersion,
        disabled,
        asButton,
    }, {
        unlocked,
        newVersion,
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                {
                    asButton ? (
                        <Button
                            primary
                            onClick={() => this.setState({ activeDialog: true })}>
                            {t('upgradeFirmware.button')}
                        </Button>
                    ) : (
                        <SettingsButton
                            onClick={() => this.setState({ activeDialog: true })}
                            disabled={disabled}
                            optionalText={newVersion}>
                            {t('upgradeFirmware.button')}
                        </SettingsButton>
                    )
                }
                {
                    activeDialog && (
                        <Dialog
                            title={t('upgradeFirmware.title')}
                            onClose={this.abort}>
                            <p className="m-top-none">{t('upgradeFirmware.description', {
                                currentVersion, newVersion
                            })}</p>
                            <DialogButtons>
                                <Button primary onClick={this.upgradeFirmware}>
                                    {t('button.upgrade')}
                                </Button>
                                <Button transparent onClick={this.abort}>
                                    {t('button.back')}
                                </Button>
                            </DialogButtons>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('upgradeFirmware.title')} includeDefault={!unlocked}>
                            {
                                unlocked ? (
                                    <div>
                                        <p className="m-top-none">{t('upgradeFirmware.unlocked')}</p>
                                        <ol style="line-height: 1.5;">
                                            <li>{t('upgradeFirmware.unlocked1')}</li>
                                            <li>{t('upgradeFirmware.unlocked2')}</li>
                                            <li>{t('upgradeFirmware.unlocked3')}</li>
                                        </ol>
                                    </div>
                                ) : (
                                    <p className="m-top-none">{t('upgradeFirmware.locked', {
                                        currentVersion, newVersion
                                    })}</p>
                                )
                            }
                        </WaitDialog>
                    )
                }
            </div>
        );
    }
}

export default translate()(UpgradeFirmware);
