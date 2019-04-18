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
import { Button } from '../../forms';
import * as style from '../../style.css';

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
}

class UpgradeButton extends Component<Props, State> {
    private upgradeFirmware = () => {
        apiPost(this.props.apiPrefix + '/upgrade-firmware');
    }

    private abort = () => {
        this.setState({ activeDialog: false });
    }

    public render(
        { t,
          versionInfo,
        }: RenderableProps<Props>,
        { activeDialog,
        }: State,
    ) {
        if (!versionInfo || !versionInfo.canUpgrade) {
            return null;
        }
        return (
            <div>
                <Button primary onClick={() => this.setState({ activeDialog: true })}>
                    {t('button.upgrade')}
                    <div class={style.badge}>1</div>
                </Button>
                {
                    activeDialog && (
                        <Dialog
                            title={t('upgradeFirmware.title')}
                            onClose={this.abort}>
                            <p>{t('upgradeFirmware.description', {
                                    currentVersion: versionInfo.currentVersion,
                                    newVersion: versionInfo.newVersion,
                            })}</p>
                            <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={this.abort}>
                                    {t('button.back')}
                                </Button>
                                <Button primary onClick={this.upgradeFirmware}>
                                    {t('button.upgrade')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<UpgradeButtonProps>()(UpgradeButton);
export { HOC as UpgradeButton };
