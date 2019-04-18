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
import { route } from 'preact-router';
import alertOctagon from '../../../assets/icons/alert-octagon.svg';
import infoIcon from '../../../assets/icons/info.svg';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button } from '../../../components/forms';
import { Step, Steps } from '../../../components/steps';
import * as style from '../../../components/steps/steps.css';
import { translate, TranslateProps } from '../../../decorators/translate';
import '../../../style/animate.css';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../alert/Alert';
import { Header } from '../../layout/header';
import { BackupsV2 } from './backups';
import { Settings } from './settings';
import { UpgradeButton, VersionInfo } from './upgradebutton';

interface BitBox02Props {
    deviceID: string;
}

type Props = BitBox02Props & TranslateProps;

interface State {
    versionInfo?: VersionInfo;
    hash?: string;
    deviceVerified: boolean;
    status: '' |
    'require_firmware_upgrade' |
    'require_app_upgrade' |
    'unpaired' |
    'pairingFailed' |
    'uninitialized' |
    'seeded' |
    'initialized';
    appStatus: 'createWallet' | 'restoreBackup' | '';
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup';
    restoreBackupStatus: 'intro' | 'restore';
    settingPassword: boolean;
    creatingBackup: boolean;
    sdCardInserted: boolean;
    errorText?: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
}

class BitBox02 extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            deviceVerified: false,
            status: '',
            settingPassword: false,
            creatingBackup: false,
            sdCardInserted: false,
            appStatus: '',
            createWalletStatus: 'intro',
            restoreBackupStatus: 'intro',
            unlockOnly: true,
            showWizard: false,
        };
    }

    private unsubscribe!: () => void;

    public componentDidMount() {
        apiGet(this.apiPrefix() + '/bundled-firmware-version').then(versionInfo => {
            this.setState({ versionInfo });
        });
        this.onChannelHashChanged();
        this.onStatusChanged();
        this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
            switch (type) {
                case 'device':
                    if (deviceID !== this.props.deviceID) {
                        return;
                    }
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

    private apiPrefix = () => {
        return 'devices/bitbox02/' + this.props.deviceID;
    }

    private handleGetStarted = () => {
        route('/account', true);
    }

    private onChannelHashChanged = () => {
        apiGet(this.apiPrefix() + '/channel-hash').then(({ hash, deviceVerified }) => {
            this.setState({ hash, deviceVerified });
        });
    }

    private onStatusChanged = () => {
        apiGet(this.apiPrefix() + '/status').then(status => {
            if (!this.state.showWizard && ['unpaired', 'uninitialized', 'seeded'].includes(status)) {
                this.setState({ showWizard: true });
            }
            if (this.state.unlockOnly && ['uninitialized', 'seeded'].includes(status)) {
                this.setState({ unlockOnly: false });
            }
            if (status === 'seeded') {
                this.setState({ appStatus: 'createWallet' });
            }
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
        apiPost(this.apiPrefix() + '/channel-hash-verify', ok);
    }

    private uninitializedStep = () => {
        this.setState({ appStatus: ''});
    }

    private createWalletStep = () => {
        this.setState({ appStatus: 'createWallet' });
    }

    private restoreBackupStep = () => {
        this.setState({ appStatus: 'restoreBackup' });
    }

    private insertSDCard = () => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/insert-sdcard').then(({ success }) => {
            if (success) {
                this.setState({ sdCardInserted: true });
            }
        });
    }

    private setPassword = () => {
        this.setState({
            settingPassword: true,
            createWalletStatus: 'setPassword',
        });
        apiPost(this.apiPrefix() + '/set-password').then(({ success }) => {
            if (!success) {
                this.setState({
                    errorText: 'Passwords did not match, please try again.',
                    settingPassword: false,
                }, () => {
                    this.setPassword();
                });
            }
            this.setState({ settingPassword: false, createWalletStatus: 'createBackup' });
        });
    }

    private restoreBackup = () => {
        this.setState({
            restoreBackupStatus: 'restore',
        });
    }

    private createBackup = () => {
        this.setState({ creatingBackup: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false });
        });
    }

    public render(
        { t, deviceID }: RenderableProps<Props>,
        { versionInfo, hash, deviceVerified, status, appStatus, createWalletStatus, restoreBackupStatus, settingPassword, creatingBackup, errorText, unlockOnly, showWizard, sdCardInserted }: State,
    ) {
        if (status === '') {
            return null;
        }
        if (status === 'require_firmware_upgrade') {
            if (!versionInfo) {
                return null;
            }
            return (
                <CenteredContent>
                    <p><strong>{t('upgradeFirmware.label')}</strong></p>
                    <UpgradeButton
                        apiPrefix={this.apiPrefix()}
                        versionInfo={versionInfo}
                    />
                </CenteredContent>
            );
        }
        if (status === 'require_app_upgrade') {
            return <AppUpgradeRequired/>;
        }
        if (!showWizard) {
            return <Settings deviceID={deviceID}/>;
        }
        // TODO: move to wizard.tsx
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
                                            <p>You have confirmed on your device that the code matches. If this is correct, you can continue by clicking the button below.</p>
                                        )
                                    }
                                </div>
                                <div className={style.buttons}>
                                    <button className={[style.button, style.primary].join(' ')} onClick={() => this.channelVerify(true)} disabled={!deviceVerified}>Confirm & Continue</button>
                                </div>
                            </Step>
                            {!unlockOnly ?
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
                                            onClick={this.restoreBackupStep}>
                                            Restore Backup
                                    </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={createWalletStatus === 'intro'}
                                    title="Create Wallet">
                                    <div className={style.stepContext}>
                                        <p>Ok, let's create a new wallet! Here are the basics steps you will be taking to setup your BitBox:</p>
                                        <ul>
                                            <li>Name your device</li>
                                            <li>Go through our guide on how to use the on screen gestures on your BitBox</li>
                                            <li>Set a password for your device</li>
                                            <li>Create a backup</li>
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
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={createWalletStatus === 'setPassword'}
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
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={status === 'seeded' && createWalletStatus === 'createBackup'}
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
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'restoreBackup' ?
                                <Step
                                    active={status !== 'initialized' && restoreBackupStatus === 'intro'}
                                    title="Restore Backup">
                                    {sdCardInserted ? true : this.insertSDCard()}
                                    <div className={style.stepContext}>
                                        <p>Ok, let's restore a backup! Here are the basics steps you will be taking to setup your BitBox:</p>
                                        <ul>
                                            <li>Name your device</li>
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
                                            disabled={!sdCardInserted}
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.restoreBackup}>
                                            {sdCardInserted ? 'Name Device & Continue' : 'Insert SD Card with Backup'}
                                        </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'restoreBackup' ?
                                <Step
                                    active={status !== 'initialized' && restoreBackupStatus === 'restore'}
                                    title="Restore Backup">
                                    <div className={style.stepContext}>
                                        <BackupsV2
                                            deviceID={deviceID}
                                            showRestore={true}
                                        />
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.uninitializedStep}
                                            disabled={settingPassword}>
                                            Back
                                        </button>
                                    </div>
                                </Step> : ''}
                            <Step
                                active={status === 'initialized'}
                                title="You're ready to go!">
                                <div className={style.stepContext}>
                                    <p>Hooray! You're BitBox is now ready to use, please use the in-app guide on each screen for further information on how to use the app with your BitBox.</p>
                                </div>
                                <Button primary onClick={this.handleGetStarted}>
                                    {t('success.getstarted')}
                                </Button>
                            </Step>
                        </Steps>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate<BitBox02Props>()(BitBox02);
export { HOC as BitBox02 };
