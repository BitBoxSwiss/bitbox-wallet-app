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
import appStoreBadge from '../../../../assets/badges/app-store-badge.svg';
import playStoreBadge from '../../../../assets/badges/google-play-badge.png';
import { alertUser } from '../../../../components/alert/Alert';
import { confirmation } from '../../../../components/confirm/Confirm';
import { Dialog } from '../../../../components/dialog/dialog';
import * as dialogStyle from '../../../../components/dialog/dialog.css';
import { Button } from '../../../../components/forms';
import { QRCode } from '../../../../components/qrcode/qrcode';
import { SettingsButton } from '../../../../components/settingsButton/settingsButton';
import { translate, TranslateProps } from '../../../../decorators/translate';
import { apiPost } from '../../../../utils/request';
import { apiWebsocket } from '../../../../utils/websocket';
import * as style from '../../device.css';

interface PairingProps {
    deviceID: string;
    deviceLocked: boolean;
    paired: boolean;
    hasMobileChannel: boolean;
    onPairingEnabled: () => void;
}

type Props = PairingProps & TranslateProps;

interface State {
    channel: string | null;
    status: string | boolean;
    showQRCode: boolean;
}

interface OnDeviceStatusProps {
    type: string;
    data: string;
    deviceID: string;
}

class MobilePairing extends Component<Props, State> {
    private unsubscribe: (() => void) | undefined;

    constructor(props) {
        super(props);
        this.state = {
            channel: null,
            status: false,
            showQRCode: false,
        };
    }

    public componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onDeviceStatus);
    }

    public componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    private onDeviceStatus = ({ type, data, deviceID }: OnDeviceStatusProps) => {
        if (type === 'device' && deviceID === this.props.deviceID) {
            switch (data) {
            case 'pairingStarted':
                this.setState({ status: 'started' });
                break;
            case 'pairingTimedout':
                if (this.state.status) {
                    this.setState({ status: 'timeout' });
                }
                break;
            case 'pairingAborted':
                this.setState({ status: 'aborted' });
                break;
            case 'pairingError':
                this.setState({ status: 'error' });
                break;
            case 'pairingSuccess':
                this.setState({ status: 'success' });
                break;
            }
        }
    }

    private reconnectUnpaired = () => {
        // If a mobile connection exists, but the device is not marked as paired, then mark it as paired.
        confirmation(this.props.t('pairing.confirm'), response => {
            if (!response) {
                return;
            }
            apiPost('devices/' + this.props.deviceID + '/feature-set', {
                pairing: true,
            }).then(() => {
                this.props.onPairingEnabled();
                alertUser(this.props.t('pairing.success.text'));
            });
        });
    }

    private startPairing = () => {
        confirmation(this.props.t('pairing.confirm'), response => {
            if (!response) {
                return;
            }
            this.setState({
                channel: null,
                status: 'loading',
            });
            apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
                if (this.props.deviceLocked) {
                    this.setState({
                        channel,
                        status: 'connectOnly',
                    });
                } else {
                    this.setState({
                        channel,
                        status: 'start',
                    });
                }
            });
        });
    }

    private abort = () => {
        this.setState({
            showQRCode: false,
            status: false,
        });
    }

    private toggleQRCode = () => {
        this.setState({ showQRCode: !this.state.showQRCode });
    }

    public render(
        { t, deviceLocked, paired, hasMobileChannel }: RenderableProps<Props>,
        { channel, status, showQRCode }: State,
    ) {
        let content;
        if (status === 'start') {
            content = (
                <div>
                    <div class="flex flex-row flex-start">
                        <div class={style.stepNumber}>1</div>
                        <div>
                            <p style="margin-top: 0;">{t('pairing.start.step1')}</p>
                            <p>
                                <Button primary onClick={this.toggleQRCode}>
                                    {t(`pairing.start.${showQRCode ? 'hideAppQRCode' : 'revealAppQRCode'}`)}
                                </Button>
                            </p>
                            {
                                showQRCode ? (
                                    <div class="flex flex-row flex-between">
                                        <div class={style.qrcodeContainer}>
                                            <p className="label" style="text-align: center;">Apple App Store</p>
                                            <QRCode data="https://itunes.apple.com/us/app/digital-bitbox-2fa/id1079896740" size={192} />
                                            <div style="text-align: center;">
                                                <a target="_blank" href="https://itunes.apple.com/us/app/digital-bitbox-2fa/id1079896740"><img src={appStoreBadge} class={style.badge} /></a>
                                            </div>
                                        </div>
                                        <div class={style.qrcodeContainer}>
                                            <p className="label" style="text-align: center;">Google Play Store</p>
                                            <QRCode data="https://play.google.com/store/apps/details?id=com.digitalbitbox.tfa" size={192} />
                                            <div style="text-align: center;">
                                                <a target="_blank" href="https://play.google.com/store/apps/details?id=com.digitalbitbox.tfa"><img src={playStoreBadge} class={style.badge} /></a>
                                            </div>
                                        </div>
                                    </div>
                                ) : null
                            }
                        </div>
                    </div>
                    <div class="flex flex-row flex-start" style="margin-top: 40px;">
                        <div class={style.stepNumber}>2</div>
                        <div>
                            <p style="margin-top: 0;">{t('pairing.start.step2')}</p>
                            <div style="text-align: center;">
                                <QRCode data={JSON.stringify(channel)} />
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else if (status === 'connectOnly') {
            content = (<QRCode data={JSON.stringify({ channel, connectOnly: true })} />);
        } else {
            content = (<p>{t(`pairing.${status}.text`)}</p>);
        }
        return (
            <div>
                <SettingsButton
                    onClick={hasMobileChannel && !paired ? this.reconnectUnpaired : this.startPairing}
                    optionalText={t(`deviceSettings.pairing.status.${paired}`)}>
                    { deviceLocked ? (
                          hasMobileChannel ? t(`pairing.reconnectOnly.button`) : t(`pairing.connectOnly.button`)
                    ) : (
                          (hasMobileChannel && !paired) ? t(`pairing.reconnectOnly.button`) : t('pairing.button')
                    )}
                </SettingsButton>
                {
                    status && (
                        <Dialog
                            title={t('pairing.title')}
                            onClose={this.abort}>
                            <div class="flex flex-column flex-center flex-items-center">
                                {
                                    channel ? (
                                        content
                                    ) : (
                                        <p>{t('loading')}</p>
                                    )
                                }
                            </div>
                            <div className={dialogStyle.actions}>
                                <Button transparent onClick={this.abort}>
                                    {t('button.back')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const translatedMobilePairing = translate<PairingProps>()(MobilePairing);
export { translatedMobilePairing as MobilePairing };
