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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Dialog } from '../../dialog/dialog';
import * as dialogStyle from '../../dialog/dialog.css';
import { Button } from '../../forms';
import { SettingsButton } from '../../settingsButton/settingsButton';

export interface VersionInfo {
    newVersion: string;
    currentVersion: string;
    canUpgrade: boolean;
}

interface UpgradeButtonProps {
    apiPrefix: string;
    versionInfo?: VersionInfo;
}

type Props = UpgradeButtonProps & TranslateProps;

interface State {
    activeDialog: boolean;
    confirming: boolean;
}

class UpgradeButton extends Component<Props, State> {
    private upgradeFirmware = () => {
        this.setState({ confirming: true });
        apiPost(this.props.apiPrefix + '/upgrade-firmware').then(() => {
            this.setState({ confirming: false });
            this.abort();
        });
    }

    private abort = () => {
        this.setState({ activeDialog: false });
    }

    public render(
        { t,
          versionInfo,
        }: RenderableProps<Props>,
        { activeDialog,
          confirming,
        }: State,
    ) {
        if (!versionInfo || !versionInfo.canUpgrade) {
            return null;
        }
        return (
            <div>
                <SettingsButton optionalText={versionInfo.newVersion} onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.upgrade')}
                </SettingsButton>
                {
                    activeDialog && (
                        <Dialog
                            title={t('upgradeFirmware.title')}
                            onClose={this.abort}>
                            {confirming ? t('confirmOnDevice') : (
                                <p>{t('upgradeFirmware.description', {
                                        currentVersion: versionInfo.currentVersion,
                                        newVersion: versionInfo.newVersion,
                                })}</p>
                            )}
                            { !confirming && (
                                <div className={dialogStyle.actions}>
                                    <Button
                                        primary
                                        onClick={this.upgradeFirmware}>
                                        {t('button.upgrade')}
                                    </Button>
                                    <Button transparent onClick={this.abort}>
                                        {t('button.back')}
                                    </Button>
                                </div>
                            )}
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<UpgradeButtonProps>()(UpgradeButton);
export { HOC as UpgradeButton };
