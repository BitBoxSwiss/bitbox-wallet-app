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
import passwordEntryGif from '../../../assets/device/bb02PwEntry.gif';
import passwordEntryOldGif from '../../../assets/device/bb02PwEntry_old.gif';
import alertOctagon from '../../../assets/icons/alert-octagon.svg';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button, Checkbox, Input  } from '../../../components/forms';
import { Step, Steps } from '../../../components/steps';
import * as style from '../../../components/steps/steps.css';
import { translate, TranslateProps } from '../../../decorators/translate';
import '../../../style/animate.css';
import { apiGet, apiPost } from '../../../utils/request';
// import SimpleMarkup from '../../../utils/simplemarkup';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../alert/Alert';
import { store as panelStore } from '../../guide/guide';
import { Header } from '../../layout/header';
import { toggleForceHide } from '../../sidebar/sidebar';
import Status from '../../status/status';
import WaitDialog from '../../wait-dialog/wait-dialog';
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
    attestationResult?: boolean;
    deviceVerified: boolean;
    status: '' |
    'require_firmware_upgrade' |
    'require_app_upgrade' |
    'connected' |
    'unpaired' |
    'pairingFailed' |
    'uninitialized' |
    'seeded' |
    'initialized';
    appStatus: 'createWallet' | 'restoreBackup' | 'restoreFromMnemonic' | 'agreement' | 'complete' | '';
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup';
    restoreBackupStatus: 'intro' | 'restore' | 'setPassword';
    settingPassword: boolean;
    creatingBackup: boolean;
    restoringFromMnemonic: boolean;
    sdCardInserted?: boolean;
    errorText?: string;
    deviceName: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    readDisclaimers: boolean;
    waitDialog?: {
        title: string;
        text?: string;
    };
}

class BitBox02 extends Component<Props, State> {
    private disclaimerForm!: HTMLElement;

    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            attestationResult: undefined,
            deviceVerified: false,
            status: '',
            settingPassword: false,
            creatingBackup: false,
            restoringFromMnemonic: false,
            sdCardInserted: undefined,
            appStatus: '',
            createWalletStatus: 'intro',
            restoreBackupStatus: 'intro',
            deviceName: '',
            unlockOnly: true,
            showWizard: false,
            readDisclaimers: false,
            waitDialog: undefined,
        };
    }

    private unsubscribe!: () => void;

    public componentWillMount() {
        if (!panelStore.state.forceHiddenSidebar) {
            toggleForceHide();
        }
    }

    public componentDidMount() {
        apiGet(this.apiPrefix() + '/bundled-firmware-version').then(versionInfo => {
            this.setState({ versionInfo });
        });
        apiGet(this.apiPrefix() + '/attestation').then(attestationResult => {
            this.setState({ attestationResult });
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
        const { showWizard, unlockOnly } = this.state;
        apiGet(this.apiPrefix() + '/status').then(status => {
            if (status !== 'initialized' && !panelStore.state.forceHiddenSidebar) {
                toggleForceHide();
            } else if (status === 'initialized' && panelStore.state.forceHiddenSidebar) {
                toggleForceHide();
            }
            if (!showWizard && ['connected', 'unpaired', 'pairingFailed', 'uninitialized', 'seeded'].includes(status)) {
                this.setState({ showWizard: true });
            }
            if (unlockOnly && ['uninitialized', 'seeded'].includes(status)) {
                this.setState({ unlockOnly: false });
            }
            if (status === 'seeded') {
                this.setState({ appStatus: 'createWallet' });
            }
            this.setState({
                status,
                errorText: undefined,
            });
            if (status === 'initialized' && unlockOnly && showWizard) {
                route('/account', true);
            }
        });
    }

    public componentWillUnmount() {
        if (this.state.status === 'initialized' && panelStore.state.forceHiddenSidebar) {
            toggleForceHide();
        }
        this.unsubscribe();
    }

    private channelVerify = ok => {
        apiPost(this.apiPrefix() + '/channel-hash-verify', ok);
    }

    private uninitializedStep = () => {
        this.setState({ appStatus: ''});
    }

    private createWalletStep = () => {
        this.insertSDCard();
        this.setState({ appStatus: 'createWallet' });
    }

    private restoreBackupStep = () => {
        this.insertSDCard();
        if (!this.state.sdCardInserted) {
            this.setState({ waitDialog: {
                title: 'Insert microSD card',
                text: 'Please insert a microSD card into your BitBox02 to continue.',
            }});
        }
        this.setState({
            appStatus: 'restoreBackup',
            restoreBackupStatus: 'restore',
        });
    }

    private insertSDCard = () => {
        apiPost('devices/bitbox02/' + this.props.deviceID + '/insert-sdcard').then(({ success, errorMessage }) => {
            if (success) {
                this.setState({ sdCardInserted: true, waitDialog: undefined });
            } else if (errorMessage) {
                this.setState({ sdCardInserted: false });
                alertUser(errorMessage);
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
        this.insertSDCard();
        this.setState({
            restoreBackupStatus: 'restore',
        });
    }

    private backupOnBeforeRestore = () => {
        this.setState({
            restoreBackupStatus: 'setPassword',
        });
    }

    private backupOnAfterRestore = (success: boolean) => {
        if (!success) {
            this.restoreBackup();
        }
    }

    private createBackup = () => {
        this.setState({ creatingBackup: true, waitDialog: {
            title: "Confirm today's date on your BitBox02",
            text: 'This date will be used to create your backup.',
        }});
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false, waitDialog: undefined });
        });
    }

    private handleDeviceNameInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        const value: string = target.value;
        this.setState({deviceName: value});
    }

    private setDeviceName = () => {
        // this.setState({ waitDialog: { title: this.props.t('bitbox02Settings.deviceName.title') } });
        this.setState({ waitDialog: { title: 'Confirm name on BitBox02' } });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/set-device-name', { name: this.state.deviceName })
        .then(result => {
            this.setState({ waitDialog: undefined });
            if (result.success) {
                this.setPassword();
            }
        });
    }

    private restoreFromMnemonic = () => {
        this.setState({ restoringFromMnemonic: true, waitDialog: {
            title: 'Follow Instructions on BitBox02',
            text: 'Please follow instructions on BitBox02 to restore from mnemonic.',
        }});
        apiPost('devices/bitbox02/' + this.props.deviceID + '/restore-from-mnemonic').then(({ success }) => {
            if (!success) {
                alertUser(this.props.t('bitbox02Wizard.restoreFromMnemonic.failed'));
            }
            this.setState({ restoringFromMnemonic: false, waitDialog: undefined });
        });
    }

    private setDisclaimerRef = (element: HTMLElement) => {
        this.disclaimerForm = element;
    }

    private handleDisclaimerCheck = () => {
        const checkboxes = this.disclaimerForm.querySelectorAll('input');
        let result = true;
        for (const checkbox of checkboxes) {
            if (!checkbox.checked) {
                result = false;
            }
        }
        this.setState({ readDisclaimers: result });
    }

    public render(
        { t, deviceID }: RenderableProps<Props>,
        {
            attestationResult,
            versionInfo,
            hash,
            status,
            appStatus,
            createWalletStatus,
            restoreBackupStatus,
            settingPassword,
            creatingBackup,
            deviceVerified,
            // restoringFromMnemonic,
            errorText,
            unlockOnly,
            showWizard,
            sdCardInserted,
            deviceName,
            readDisclaimers,
            waitDialog,
        }: State,
    ) {
        if (status === '') {
            return null;
        }
        if (!versionInfo) {
            return null;
        }
        if (status === 'require_firmware_upgrade') {
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
        const passwordGif = versionInfo.currentVersion === '1.0.0' || versionInfo.currentVersion === '2.0.0' ? passwordEntryOldGif : passwordEntryGif;
        // TODO: move to wizard.tsx
        return (
            <div className="contentWithGuide">
                {
                    waitDialog && (
                      <WaitDialog title={waitDialog.title}>
                          {waitDialog.text ? waitDialog.text : t('bitbox02Interact.followInstructions')}
                      </WaitDialog>
                    )
                }
                <div className="container">
                    <Header title={<h2>{t('welcome.title')}</h2>} />
                    <div className="flex flex-column flex-start flex-items-center flex-1 scrollableContainer">
                        <Steps>
                            <Step active={status === 'connected'} title={t('button.unlock')} width={700}>
                                <div className={style.stepContext}>
                                    {/* <p className="text-center">{t('unlock.description')}</p> */}
                                    <p className="text-center">Enter BitBox02 password to unlock.</p>
                                    <div className={style.passwordGesturesGifWrapper}>
                                        <img class={style.passwordGesturesGif} src={passwordGif}/>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                active={status === 'unpaired' || status === 'pairingFailed'}
                                title={t('bitbox02Wizard.pairing.title')}>
                                {
                                    status === 'pairingFailed' && (
                                        <div className={[style.standOut, style.error].join(' ')}>
                                            <span>{t('bitbox02Wizard.pairing.failed')}</span>
                                        </div>
                                    )
                                }
                                <div className={[style.stepContext, status === 'pairingFailed' ? style.disabled : ''].join(' ')}>
                                    {/* <p>{t('bitbox02Wizard.pairing.unpaired')}</p> */}
                                    <p>Please verify the pairing code matches what is shown on your BitBox02.</p>
                                    <pre>{hash}</pre>
                                    {
                                        deviceVerified && (
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    onClick={() => this.channelVerify(true)}
                                                    disabled={!deviceVerified}>
                                                    {t('bitbox02Wizard.pairing.confirmButton')}
                                                </Button>
                                            </div>
                                        )
                                    }
                                </div>
                            </Step>

                            {
                                !unlockOnly && (
                                    <Step
                                        active={status === 'uninitialized' && appStatus === ''}
                                        // title={t('bitbox02Wizard.initialize.title')}
                                        title="Setup your BitBox02"
                                        large>
                                        <div className={[style.standOut, style.info].join(' ')}>
                                            <span>{t('bitbox02Wizard.initialize.tip')}</span>
                                        </div>
                                        <div className="columnsContainer m-top-default">
                                            <div className="columns">
                                                <div className="column column-1-2">
                                                    <div className={style.stepContext}>
                                                        <h3 className={style.stepSubHeader}>Create</h3>
                                                        {/* <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.initialize.text')} /> */}
                                                        <p className="text-center">I want to setup a new BitBox02.</p>
                                                        <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                            <Button
                                                                primary
                                                                onClick={this.createWalletStep}
                                                                disabled={settingPassword}>
                                                                {t('seed.create')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="column column-1-2">
                                                    <div className={style.stepContext}>
                                                        <h3 className={style.stepSubHeader}>Restore</h3>
                                                        {/* <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.initialize.text')} /> */}
                                                        <p className="text-center">I want to restore my wallet from a backup.</p>
                                                        <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                            <Button
                                                                secondary
                                                                onClick={this.restoreBackupStep}>
                                                                {/* {t('backup.restore.confirmTitle')} */}
                                                                Restore from microSD card
                                                            </Button>
                                                            <Button
                                                                secondary
                                                                onClick={this.restoreFromMnemonic}>
                                                                {/* {t('backup.restoreFromMnemonic.confirmTitle')} */}
                                                                Restore from mnemonic
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                !unlockOnly && appStatus === 'createWallet' && (
                                    <Step
                                        active={createWalletStatus === 'intro'}
                                        // title={t('seed.create')}
                                        title="Choose BitBox02 Name">
                                        <div className={[style.standOut, style.info].join(' ')}>
                                            {/* <SimpleMarkup tagName="span" markup={t('bitbox02Wizard.insertSDCard')} /> */}
                                            <span>Please make sure your microSD card is inserted in your BitBox02.</span>
                                        </div>
                                        <div className={style.stepContext}>
                                            {/* <p>{t('bitbox02Wizard.create.text')} {t('bitbox02Wizard.create.info')}</p> */}
                                            <Input
                                                className={style.wizardLabel}
                                                // label={t('bitbox02Settings.deviceName.title')}
                                                label="BitBox02 name"
                                                pattern="^.{0,63}$"
                                                onInput={this.handleDeviceNameInput}
                                                // placeholder={t('bitbox02Settings.deviceName.input')}
                                                placeholder="My BitBox02"
                                                value={deviceName}
                                                id="deviceName"
                                            />
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    disabled={!deviceName || !sdCardInserted}
                                                    onClick={this.setDeviceName}>
                                                    {/* {t('bitbox02Wizard.create.button')} */}
                                                    Continue
                                                </Button>
                                                <Button
                                                    secondary
                                                    onClick={() => this.setState({ appStatus: '' })}>
                                                    Go Back
                                                </Button>
                                            </div>
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'createWallet') && (
                                    <Step
                                        width={700}
                                        active={createWalletStatus === 'setPassword'}
                                        // title={t('bitbox02Wizard.initialize.passwordTitle')}
                                        title="Set BitBox02 Password">
                                        <div className={style.stepContext}>
                                            {
                                                errorText && (
                                                    <div className={style.standOut}>
                                                        <img src={alertOctagon} />
                                                        <span className={style.error}>{errorText}</span>
                                                    </div>
                                                )
                                            }
                                            {/* <p>{t('bitbox02Wizard.initialize.passwordText')}</p> */}
                                            <p className="text-center">Use the controls on your BitBox02 to set a password.</p>
                                            <div className={style.passwordGesturesGifWrapper}>
                                                <img class={style.passwordGesturesGif} src={passwordGif}/>
                                            </div>
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'createWallet') && (
                                    <Step
                                        active={status === 'seeded' && createWalletStatus === 'createBackup'}
                                        title={t('backup.create.title')}>
                                        <div className={style.stepContext}>
                                            {/* <p>{t('bitbox02Wizard.backup.text1')}</p>
                                            <p>{t('bitbox02Wizard.backup.text2')}</p>
                                            <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.backup.text3')} /> */}
                                            <p>Now a backup of your wallet will be created on your microSD card.</p>
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    onClick={this.createBackup}
                                                    disabled={creatingBackup}>
                                                    {t('backup.create.title')}
                                                </Button>
                                            </div>
                                        </div>
                                    </Step>
                                )
                            }

                            {/* {
                                (!unlockOnly && appStatus === 'restoreBackup') && (
                                    <Step
                                        active={status !== 'initialized' && restoreBackupStatus === 'intro'}
                                        title={t('backup.restore.confirmTitle')}>
                                        <div className={style.stepContext}>
                                            <p>{t('bitbox02Wizard.backup.restoreText')}</p>
                                            <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.insertSDCard')} />
                                            <p>{t('bitbox02Wizard.create.info')}</p>
                                            <ul>
                                                <li>{t('bitbox02Wizard.backup.point1')}</li>
                                                <li>{t('bitbox02Wizard.backup.point2')}</li>
                                            </ul>
                                        </div>
                                        <div className="buttons text-center">
                                            <Button
                                                primary
                                                onClick={this.restoreBackup}
                                                disabled={!sdCardInserted}>
                                                {t('seedRestore.info.button')}
                                            </Button>
                                        </div>
                                    </Step>
                                )
                            } */}

                            {
                                (!unlockOnly && appStatus === 'restoreBackup') && (
                                    <Step
                                        active={status !== 'initialized' && restoreBackupStatus === 'restore'}
                                        title={t('backup.restore.confirmTitle')}>
                                        <BackupsV2
                                            deviceID={deviceID}
                                            showRestore={true}
                                            showRadio={true}
                                            backupOnBeforeRestore={this.backupOnBeforeRestore}
                                            backupOnAfterRestore={this.backupOnAfterRestore}>
                                            <Button
                                                secondary
                                                onClick={this.uninitializedStep}
                                                disabled={settingPassword}>
                                                {t('button.back')}
                                            </Button>
                                        </BackupsV2>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'restoreBackup') && (
                                    <Step
                                        width={700}
                                        active={status !== 'initialized' && restoreBackupStatus === 'setPassword'}
                                        // title={t('bitbox02Wizard.initialize.passwordTitle')}
                                        title="Set BitBox02 Password">
                                        <div className={style.stepContext}>
                                            {
                                                errorText && (
                                                    <div className={style.standOut}>
                                                        <img src={alertOctagon} />
                                                        <span className={style.error}>{errorText}</span>
                                                    </div>
                                                )
                                            }
                                            {/* <p>{t('bitbox02Wizard.initialize.passwordText')}</p> */}
                                            <p className="text-center">Use the controls on your BitBox02 to set a password.</p>
                                            <div className={style.passwordGesturesGifWrapper}>
                                                <img class={style.passwordGesturesGif} src={passwordGif}/>
                                            </div>
                                        </div>
                                    </Step>
                                )
                            }

                            {/* {
                                (!unlockOnly && appStatus === 'restoreFromMnemonic') && (
                                    <Step
                                        active={status !== 'initialized'}
                                        title={t('backup.restoreFromMnemonic.confirmTitle')}>
                                        <div className={style.stepContext}>
                                            <p>{t('bitbox02Wizard.backup.restoreText')}</p>
                                            <p>{t('bitbox02Wizard.create.info')}</p>
                                            <ul>
                                                <li>{t('bitbox02Wizard.restoreFromMnemonic.point1')}</li>
                                                <li>{t('bitbox02Wizard.restoreFromMnemonic.point2')}</li>
                                            </ul>
                                        </div>
                                        <div className="buttons text-center">
                                            <Button
                                                primary
                                                disabled={restoringFromMnemonic}
                                                onClick={this.restoreFromMnemonic}>
                                                {t('backup.restoreFromMnemonic.confirmTitle')}
                                            </Button>
                                        </div>
                                    </Step>
                                )
                            } */}

                            <Step
                                width={700}
                                active={status === 'initialized'}
                                title={t('bitbox02Wizard.success.title')}>
                                <div className={style.stepContext}>
                                    {/* <p>{t('bitbox02Wizard.success.text')}</p> */}
                                    <p>Your backup has been created and your BitBox02 is ready to use. Please remove the microSD card from your BitBox02 and store it in a secure location.</p>
                                    <p>I understand the following:</p>
                                    <form ref={this.setDisclaimerRef}>
                                        <div>
                                            <Checkbox onChange={this.handleDisclaimerCheck} className={style.wizardCheckbox} id="agreement1" label="If I lose or damage my BitBox02, the only way to recover my funds is by restoring from my backup." />
                                        </div>
                                        <div className="m-top-quarter">
                                            <Checkbox onChange={this.handleDisclaimerCheck} className={style.wizardCheckbox} id="agreement2" label="If I lose my backup and lose/damage my device, my funds will be lost." />
                                        </div>
                                        <div className="m-top-quarter">
                                            <Checkbox onChange={this.handleDisclaimerCheck} className={style.wizardCheckbox} id="agreement3" label="My backup is NOT protected with my BitBox02 password. Anyone with access to my backup has access to my wallet." />
                                        </div>
                                        <div className="m-top-quarter">
                                            <Checkbox onChange={this.handleDisclaimerCheck} className={style.wizardCheckbox} id="agreement4" label="I should store my backup in a secure location." />
                                        </div>
                                    </form>
                                    <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                        <Button primary onClick={this.handleGetStarted} disabled={!readDisclaimers}>
                                            {/* {t('success.getstarted')} */}
                                            Confirm and get started
                                        </Button>
                                    </div>
                                </div>
                            </Step>
                        </Steps>
                    </div>
                    {
                        attestationResult === false && (
                            <Status>
                                {t('bitbox02Wizard.attestationFailed')}
                            </Status>
                        )
                    }
                </div>
            </div>
        );
    }
}

const HOC = translate<BitBox02Props>()(BitBox02);
export { HOC as BitBox02 };
