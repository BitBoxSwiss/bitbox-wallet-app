/**
 * Copyright 2019 Shift Devices AG
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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import { BaseUpdateInfo } from '../../routes/bitboxbase/bitboxbase';
import { apiPost } from '../../utils/request';
import { alertUser } from '../alert/Alert';
import { Dialog } from '../dialog/dialog';
import * as dialogStyle from '../dialog/dialog.css';
import { Button } from '../forms';
import { SettingsButton } from '../settingsButton/settingsButton';

interface UpdateBaseButtonProps {
    apiPrefix: string;
    updateInfo: BaseUpdateInfo;
    currentVersion: string;
}

type Props = UpdateBaseButtonProps & TranslateProps;

interface State {
    activeDialog: boolean;
}

class UpdateBaseButton extends Component<Props, State> {
    private updateBase = () => {
        apiPost(this.props.apiPrefix + '/update-base', {version: '0.0.4'})
        .then(response => {
            if (!response.success) {
                alertUser(response.message);
            } else {
                console.log('Initiated update');
            }
        });
    }

    private abort = () => {
        this.setState({ activeDialog: false });
    }

    public render(
        { t,
          updateInfo,
          currentVersion,
        }: RenderableProps<Props>,
        { activeDialog,
        }: State,
    ) {
        return (
            <div>
                    <SettingsButton optionalText={`${updateInfo.version} available`} onClick={() => this.setState({ activeDialog: true })}>
                        {t('button.update')}
                    </SettingsButton>
                {
                    activeDialog && (
                        <Dialog
                            title={t('bitboxBase.settings.system.updateTitle')}
                            onClose={this.abort}
                            slim
                            medium>
                            <div className={dialogStyle.detail}>
                                <label>{t('bitboxBase.settings.system.updateSeverity')}:</label>
                                <p>{updateInfo.severity}</p>
                            </div>
                            <div className={dialogStyle.detail}>
                                <label>{t('deviceSettings.firmware.newVersion.label')}:</label>
                                <p>{updateInfo.version}</p>
                            </div>
                            <div className={[dialogStyle.detail, dialogStyle.description].join(' ')}>
                                <label>{t('generic.description')}:</label>
                                <span>
                                    <p>{updateInfo.description}</p>
                                </span>
                            </div>
                            <div className={[dialogStyle.confirmationInstructions, dialogStyle.confirm].join(' ')}>
                                {t('bitboxBase.settings.system.confirmUpdate', {
                                    current: currentVersion,
                                    newVersion: updateInfo.version},
                                )
                                }
                            </div>
                            <div className={[dialogStyle.buttons, 'flex', 'flex-row', 'flex-between'].join(' ')}>
                                <Button transparent onClick={this.abort}>
                                    {t('button.back')}
                                </Button>
                                <Button
                                    primary
                                    onClick={this.updateBase}>
                                    {t('button.update')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<UpdateBaseButtonProps>()(UpdateBaseButton);
export { HOC as UpdateBaseButton };
