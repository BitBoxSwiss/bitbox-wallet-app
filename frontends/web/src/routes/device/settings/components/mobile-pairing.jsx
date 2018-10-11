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
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import QRCode from '../../../../components/qrcode/qrcode';
import { apiPost } from '../../../../utils/request';
import { Dialog } from '../../../../components/dialog/dialog';
import { apiWebsocket } from '../../../../utils/websocket';

@translate()
export default class MobilePairing extends Component {
    state = {
        channel: null,
        status: false,
    }

    componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onDeviceStatus);
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    onDeviceStatus = ({ type, data, deviceID }) => {
        if (type === 'device' && deviceID === this.props.deviceID) {
            switch (data){
            case 'pairingStarted':
                this.setState({ status: 'started' });
                break;
            case 'pairingTimedout':
                if (this.state.status) this.setState({ status: 'timeout' });
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

    startPairing = () => {
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
    }

    abort = () => {
        this.setState({ status: false });
    }

    render({
        t,
        deviceLocked,
        mobilePaired,
    }, {
        channel,
        status,
    }) {
        let content;
        if (status === 'start') {
            content = (<QRCode data={JSON.stringify(channel)} />);
        } else if (status === 'connectOnly') {
            content = (<QRCode data={JSON.stringify({ ...channel, connectOnly: true })} />);
        } else {
            content = (<p>{t(`pairing.${status}.text`)}</p>);
        }

        return (
            <div>
                <Button primary onClick={this.startPairing}>
                    {!deviceLocked && t('pairing.button')}
                    {deviceLocked && !mobilePaired && t(`pairing.connectOnly.button`)}
                    {deviceLocked && mobilePaired && t(`pairing.reconnectOnly.button`)}
                </Button>
                {
                    status && (
                        <Dialog
                            title={t(`pairing.${status}.title`)}
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
                            <div class="flex flex-row flex-center" style="margin-top: var(--spacing-default)">
                                <Button secondary onClick={this.abort}>
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
