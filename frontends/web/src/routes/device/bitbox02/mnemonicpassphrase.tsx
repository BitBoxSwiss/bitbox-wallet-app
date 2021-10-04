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

import { Component, h, RenderableProps } from 'preact';
import { getDeviceInfo, setMnemonicPassphraseEnabled, DeviceInfo } from '../../../api/bitbox02';
import { translate, TranslateProps } from '../../../decorators/translate';
import { SimpleMarkup } from '../../../utils/simplemarkup';
import { alertUser } from '../../../components/alert/Alert';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

interface MnemonicPassphraseButtonProps {
    deviceID: string;
    deviceInfo: DeviceInfo;
}

interface State {
    inProgress: boolean;
    deviceInfo: DeviceInfo;
}

type Props = MnemonicPassphraseButtonProps & TranslateProps;

class MnemonicPassphraseButton extends Component<Props, State> {
    public readonly state: State = {
        inProgress: false,
        deviceInfo: this.props.deviceInfo,
    }

    private getDeviceInfo = () => {
        getDeviceInfo(this.props.deviceID)
            .then(deviceInfo => this.setState({ deviceInfo }));
    }

    private toggle = () => {
        const { t } = this.props;
        const enable = !this.state.deviceInfo.mnemonicPassphraseEnabled;
        this.setState({ inProgress: true });
        setMnemonicPassphraseEnabled(this.props.deviceID, enable)
            .then(() => {
                this.setState({ inProgress: false });
                if (enable) {
                    alertUser(t('bitbox02Settings.mnemonicPassphrase.successEnable'));
                } else {
                    alertUser(t('bitbox02Settings.mnemonicPassphrase.successDisable'));
                }
                this.getDeviceInfo();
            })
            .catch((e) => {
                this.setState({ inProgress: false });
                alertUser(t(`mnemonicPassphrase.error.e${e.code}`, {
                    defaultValue: e.message || t('genericError'),
                }));
            });
    }

    private renderLine = (line: string, i: number) => (
        <span key={`${line}-${i}`}>
            <SimpleMarkup tagName="span" markup={line} /><br/>
        </span>
    )

    public render(
        { t }: RenderableProps<Props>,
        { deviceInfo, inProgress }: State,
    ) {
        const enabled = deviceInfo.mnemonicPassphraseEnabled;
        const title = enabled ? t('bitbox02Settings.mnemonicPassphrase.disable') : t('bitbox02Settings.mnemonicPassphrase.enable');
        const message = t('bitbox02Settings.mnemonicPassphrase.description');
        return (
            <div>
                <SettingsButton onClick={this.toggle}>{title}</SettingsButton>
                { inProgress && (
                    <WaitDialog title={title}>
                        <div className="columnsContainer half">
                            <div className="columns">
                                <div className="column">
                                    { !enabled && message && (
                                        <p>
                                            { message.split('\n').map(this.renderLine) }
                                        </p>
                                    ) }
                                    <p>{t('bitbox02Interact.followInstructions')}</p>
                                </div>
                            </div>
                        </div>
                    </WaitDialog>
                ) }
            </div>
        );
    }
}

const HOC = translate<MnemonicPassphraseButtonProps>()(MnemonicPassphraseButton );
export { HOC as MnemonicPassphraseButton  };
