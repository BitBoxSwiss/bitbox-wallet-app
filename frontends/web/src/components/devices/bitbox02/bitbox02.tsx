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
import alertOctagon from '../../../assets/icons/alert-octagon.svg';
import infoIcon from '../../../assets/icons/info.svg';
import { Step, Steps } from '../../../components/steps';
import * as style from '../../../components/steps/steps.css';
import RandomNumber from '../../../routes/device/settings/components/randomnumber';
import '../../../style/animate.css';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../alert/Alert';
import { Header } from '../../layout/header';
import DeviceInfo from './deviceinfo';
import SetDeviceName from './setdevicename';

interface Props {
    deviceID: string;
}

interface State {
    hash?: string;
    deviceVerified: boolean;
    status: 'unpaired' |
            'pairingFailed' |
            'uninitialized' |
            'seeded' |
            'initialized' |
            'unlocked';
    appStatus: 'createWallet' | 'setPassword' | '';
    settingPassword: boolean;
    creatingBackup: boolean;
    msdInserted: boolean;
    errorText?: string;
}

class BitBox02 extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            deviceVerified: false,
            status: 'unpaired',
            settingPassword: false,
            creatingBackup: false,
            msdInserted: false,
            appStatus: '',
        };
    }

    private unsubscribe!: () => void;

    public componentDidMount() {
        this.onChannelHashChanged();
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data }) => {
            switch (type) {
                case 'device':
                    switch (data) {
                        case 'channelHashChanged':
                            this.onChannelHashChanged();
                            break;
                        case 'statusChanged':
                            this.onStatusChanged();
                            break;
                    }
                    break;
            }
        });
    }

    private onChannelHashChanged = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/channel-hash').then(({ hash, deviceVerified }) => {
            this.setState({ hash, deviceVerified });
        });
    }

    private onStatusChanged = () => {
        apiGet('devices/bitbox02/' + this.props.deviceID + '/status').then(status => {
            this.setState({
                status,
                errorText: undefined,
            });
        });
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private channelVerify = ok => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/channel-hash-verify', ok);
    }

    private createWalletStep = () => {
        this.setState({ appStatus: 'createWallet' });
    }

    private setPassword = () => {
        this.setState({
            settingPassword: true,
            appStatus: 'setPassword',
        });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/set-password').then(({ success }) => {
            if (!success) {
                this.setState({
                    errorText: 'Passwords did not match, please try again.',
                    settingPassword: false,
                }, () => {
                    this.setPassword();
                });
            }
            this.setState({ settingPassword: false, appStatus: '' });
        });
    }

    private createBackup = () => {
        this.setState({ creatingBackup: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/create-backup').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false });
        });
    }

    public render(
        { deviceID }: RenderableProps<Props>,
        { hash, deviceVerified, status, appStatus, settingPassword, creatingBackup, errorText }: State,
    ) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>Welcome</h2>} />
                    <div className="flex flex-column flex-start flex-items-center flex-1 scrollableContainer" style="background-color: #F9F9F9;">
                        <Steps>
                            <Step
                                active={status === 'unpaired' || status === 'pairingFailed'}
                                title="Verify your BitBox">
                                {
                                    status === 'pairingFailed' && (
                                        <div className={style.standOut}>
                                            <img src={alertOctagon} />
                                            <span className={style.error}>Unconfirmed pairing. Please replug your BitBox02.</span>
                                        </div>
                                    )
                                }
                                <div className={[style.stepContext, status === 'pairingFailed' ? style.disabled : ''].join(' ')}>
                                    <p>A new BitBox has been detected. Please verify that the following code matches what is shown on your device. If the code matches, touch "Correct" on your device and then the button below to continue.</p>
                                    <pre>{hash}</pre>
                                    {
                                        deviceVerified && (
                                            <p>You have intereacted with your device that the code matches. If this is correct, you can continue by clicking the button below.</p>
                                        )
                                    }
                                </div>
                                <div className={style.buttons}>
                                    <button className={[style.button, style.primary].join(' ')} onClick={() => this.channelVerify(true)} disabled={!deviceVerified}>Confirm & Continue</button>
                                </div>
                            </Step>
                            <Step
                                active={status === 'uninitialized' && appStatus === ''}
                                title="Initialize your BitBox">
                                <div className={style.standOut}>
                                    <img src={infoIcon} />
                                    <span className={style.info}>Before continuing, it is highly recommended that you proceed in a secure environment.</span>
                                </div>
                                <div className={style.stepContext}>
                                    <p>Successfully paired your BitBox! Now let's initialize your device. Get started by choosing to create a new wallet, or to restore a wallet from an existing backup. Please make sure you have a microSD card inserted in your BitBox.</p>
                                </div>
                                <div className={style.buttons}>
                                    <button
                                        className={[style.button, style.primary].join(' ')}
                                        onClick={this.createWalletStep}
                                        disabled={settingPassword}>
                                        Create Wallet
                                    </button>
                                    <button
                                        className={[style.button, style.secondary].join(' ')}
                                        disabled={true}>
                                        Restore Backup
                                    </button>
                                </div>
                            </Step>
                            <Step
                                active={appStatus === 'createWallet' && !settingPassword}
                                title="Create Wallet">
                                <div className={style.stepContext}>
                                    <p>Ok, let's create a new wallet! Here are the basics steps you will be taking to setup your BitBox:</p>
                                    <ul>
                                        <li>Name your device</li>
                                        <li>Go through our guide on how to use the on screen gestures on your BitBox</li>
                                        <li>Choose to create or restore a wallet</li>
                                        <li>Set a password for your device</li>
                                        <li>Poop</li>
                                    </ul>
                                    <div className={style.inputGroup}>
                                        <label className={style.label}>Wallet Name</label>
                                        <input type="text" className={style.input} placeholder="Name of your BitBox" />
                                    </div>
                                </div>
                                <div className={style.buttons}>
                                    <button
                                        className={[style.button, style.primary].join(' ')}
                                        onClick={this.setPassword}>
                                        Name Device & Continue
                                    </button>
                                </div>
                            </Step>
                            <Step
                                active={appStatus === 'setPassword'}
                                title="Set a password for your BitBox">
                                {
                                    errorText && (
                                        <div className={style.standOut}>
                                            <img src={alertOctagon} />
                                            <span className={style.error}>{errorText}</span>
                                        </div>
                                    )
                                }
                                <div className={style.stepContext}>
                                    <p>Now let's set a password for your device. Use the controls on your BitBox to enter and choose a password.</p>
                                </div>
                            </Step>
                            <Step
                                active={status === 'seeded'}
                                title="Create Backup">
                                <div className={style.stepContext}>
                                    <p>Great, your password is now set and the device is seeded. Now it's time to create your first backup. Please make sure you have your microSD card inserted in your BitBox and continue.</p>
                                    <p>Please follow the on-screen instruction on your device to create a backup.</p>
                                </div>
                                <div className={style.buttons}>
                                    <button
                                        className={[style.button, style.primary].join(' ')}
                                        onClick={this.createBackup}
                                        disabled={creatingBackup}>
                                        Create Backup
                                    </button>
                                </div>
                            </Step>
                            <Step
                                active={status === 'unlocked'}
                                title="You're ready to go!">
                                <div className={style.stepContext}>
                                    <p>Hooray! You're BitBox is now ready to use, please use the in-app guide on each screen for further information on how to use the app with your BitBox.</p>
                                </div>
                                <div className={style.buttons}>
                                    <RandomNumber apiPrefix={'devices/bitbox02/' + deviceID} />
                                    <DeviceInfo apiPrefix={'devices/bitbox02/' + deviceID} />
                                    <SetDeviceName apiPrefix={'devices/bitbox02/' + deviceID} />
                                </div>
                            </Step>
                        </Steps>
                    </div>
                </div>
            </div>
        );
    }
}

export { BitBox02 };
