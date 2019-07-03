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
import alertOctagon from '../../../assets/icons/alert-octagon.svg';
import infoIcon from '../../../assets/icons/info.svg';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button, Input } from '../../../components/forms';
import { Step, Steps } from '../../../components/steps';
import * as style from '../../../components/steps/steps.css';
import { translate, TranslateProps } from '../../../decorators/translate';
import '../../../style/animate.css';
import { apiGet, apiPost } from '../../../utils/request';
import SimpleMarkup from '../../../utils/simplemarkup';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../alert/Alert';
import { Header } from '../../layout/header';
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
    appStatus: 'createWallet' | 'restoreBackup' | '';
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup';
    restoreBackupStatus: 'intro' | 'restore' | 'setPassword';
    settingPassword: boolean;
    creatingBackup: boolean;
    sdCardInserted?: boolean;
    errorText?: string;
    deviceName: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    waitDialog?: {
        title: string;
    };
}

class BitBox02 extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            attestationResult: undefined,
            deviceVerified: false,
            status: '',
            settingPassword: false,
            creatingBackup: false,
            sdCardInserted: undefined,
            appStatus: '',
            createWalletStatus: 'intro',
            restoreBackupStatus: 'intro',
            deviceName: '',
            unlockOnly: true,
            showWizard: false,
            waitDialog: undefined,
        };
    }

    private unsubscribe!: () => void;

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
        apiGet(this.apiPrefix() + '/status').then(status => {
            if (!this.state.showWizard && ['connected', 'unpaired', 'pairingFailed', 'uninitialized', 'seeded'].includes(status)) {
                this.setState({ showWizard: true });
            }
            if (this.state.unlockOnly && ['uninitialized', 'seeded'].includes(status)) {
                this.setState({ unlockOnly: false });
                this.insertSDCard();
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
        apiPost('devices/bitbox02/' + this.props.deviceID + '/insert-sdcard').then(({ success, errorMessage }) => {
            if (success) {
                this.setState({ sdCardInserted: true });
            } else if (errorMessage) {
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
        this.setState({ creatingBackup: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false });
        });
    }

    private handleDeviceNameInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        const value: string = target.value;
        this.setState({deviceName: value});
    }

    private setDeviceName = () => {
        this.setState({ waitDialog: { title: this.props.t('bitbox02Settings.deviceName.title') } });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/set-device-name', { name: this.state.deviceName })
        .then(result => {
            this.setState({ waitDialog: undefined });
            if (result.success) {
                this.setPassword();
            }
        });
    }

    public render(
        { t, deviceID }: RenderableProps<Props>,
        { attestationResult,
          versionInfo,
          hash,
          deviceVerified,
          status,
          appStatus,
          createWalletStatus,
          restoreBackupStatus,
          settingPassword,
          creatingBackup,
          errorText,
          unlockOnly,
          showWizard,
          sdCardInserted,
          deviceName,
          waitDialog }: State,
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
                { waitDialog && (
                      <WaitDialog
                          title={waitDialog.title}
                      >
                          {t('bitbox02Interact.followInstructions')}
                      </WaitDialog>
                )}
                <div className="container">
                    <Header title={<h2>{t('welcome.title')}</h2>} />

                    <div className="flex flex-column flex-start flex-items-center flex-1 scrollableContainer" style="background-color: #F9F9F9;">
                        { attestationResult === false && (
                            <div className={style.warningBlockContainer}>
                                <div className={style.warningBlock}>
                                    {t('bitbox02Wizard.attestationFailed')}
                                </div>
                            </div>
                        )}
                        <Steps>
                            <Step active={status === 'connected'}
                                  title={t('button.unlock')}>
                                <div className={style.stepContext}>
                                    <p>{t('unlock.description')}</p>
                                </div>
                                <div className={style.passwordGesturesGifWrapper}>
                                    <img class={style.passwordGesturesGif} src={passwordEntryGif}/>
                                </div>
                            </Step>
                            <Step
                                active={status === 'unpaired' || status === 'pairingFailed'}
                                title={t('bitbox02Wizard.pairing.title')}>
                                {
                                    status === 'pairingFailed' && (
                                        <div className={style.standOut}>
                                            <img src={alertOctagon} />
                                            <span className={style.error}>{t('bitbox02Wizard.pairing.failed')}</span>
                                        </div>
                                    )
                                }
                                <div className={[style.stepContext, status === 'pairingFailed' ? style.disabled : ''].join(' ')}>
                                    <p>{t('bitbox02Wizard.pairing.unpaired')}</p>
                                    <pre>{hash}</pre>
                                    {
                                        deviceVerified && (
                                            <p>{t('bitbox02Wizard.pairing.paired')}</p>
                                        )
                                    }
                                </div>
                                <div className={style.buttons}>
                                    <button className={[style.button, style.primary].join(' ')} onClick={() => this.channelVerify(true)} disabled={!deviceVerified}>
                                        {t('bitbox02Wizard.pairing.confirmButton')}
                                    </button>
                                </div>
                            </Step>
                            {!unlockOnly ?
                                <Step
                                    active={status === 'uninitialized' && appStatus === ''}
                                    title={t('bitbox02Wizard.initialize.title')}>
                                    {sdCardInserted ? true : this.insertSDCard()}
                                    <div className={style.standOut}>
                                        <img src={infoIcon} />
                                        <span className={style.info}>{t('bitbox02Wizard.initialize.tip')}</span>
                                    </div>
                                    <div className={style.stepContext}>
                                        <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.initialize.text')} />
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.createWalletStep}
                                            disabled={settingPassword || !sdCardInserted}>
                                            {t('seed.create')}
                                    </button>
                                        <button
                                            className={[style.button, style.secondary].join(' ')}
                                            onClick={this.restoreBackupStep}
                                            disabled={!sdCardInserted}>
                                            {t('backup.restore.confirmTitle')}
                                    </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={createWalletStatus === 'intro'}
                                    title={t('seed.create')}>
                                    <div className={style.stepContext}>
                                        <p>{t('bitbox02Wizard.create.text')}</p>
                                        <p>{t('bitbox02Wizard.create.info')}</p>
                                        <ul>
                                            <li>{t('bitbox02Wizard.create.point1')}</li>
                                            <li>{t('bitbox02Wizard.create.point2')}</li>
                                            <li>{t('bitbox02Wizard.create.point3')}</li>
                                        </ul>
                                        <div className={style.inputGroup}>
                                            <Input
                                                label={t('bitbox02Settings.deviceName.title')}
                                                pattern="^.{0,63}$"
                                                onInput={this.handleDeviceNameInput}
                                                placeholder={t('bitbox02Settings.deviceName.input')}
                                                value={deviceName}
                                                id="deviceName"
                                            />
                                        </div>
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            disabled={!deviceName}
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.setDeviceName}>
                                            {t('bitbox02Wizard.create.button')}
                                    </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={createWalletStatus === 'setPassword'}
                                    title={t('bitbox02Wizard.initialize.passwordTitle')}>
                                    {
                                        errorText && (
                                            <div className={style.standOut}>
                                                <img src={alertOctagon} />
                                                <span className={style.error}>{errorText}</span>
                                            </div>
                                        )
                                    }
                                    <div className={style.stepContext}>
                                        <p>{t('bitbox02Wizard.initialize.passwordText')}</p>
                                    </div>
                                    <div className={style.passwordGesturesGifWrapper}>
                                        <img class={style.passwordGesturesGif} src={passwordEntryGif}/>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'createWallet' ?
                                <Step
                                    active={status === 'seeded' && createWalletStatus === 'createBackup'}
                                    title={t('backup.create.title')}>
                                    <div className={style.stepContext}>
                                        <p>{t('bitbox02Wizard.backup.text1')}</p>
                                        <p>{t('bitbox02Wizard.backup.text2')}</p>
                                        <SimpleMarkup tagName="p" markup={t('bitbox02Wizard.backup.text3')} />
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.createBackup}
                                            disabled={creatingBackup}>
                                            {t('backup.create.title')}
                                        </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'restoreBackup' ?
                                <Step
                                    active={status !== 'initialized' && restoreBackupStatus === 'intro'}
                                    title={t('backup.restore.confirmTitle')}>
                                    <div className={style.stepContext}>
                                        <p>{t('bitbox02Wizard.backup.restoreText')}</p>
                                        <p>{t('bitbox02Wizard.create.info')}</p>
                                        <ul>
                                            <li>{t('bitbox02Wizard.backup.point1')}</li>
                                            <li>{t('bitbox02Wizard.backup.point2')}</li>
                                        </ul>
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.restoreBackup}>
                                            {t('seedRestore.info.button')}
                                        </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'restoreBackup' ?
                                <Step
                                    active={status !== 'initialized' && restoreBackupStatus === 'restore'}
                                    title={t('backup.restore.confirmTitle')}>
                                    <div className={style.stepContext}>
                                        <BackupsV2
                                            deviceID={deviceID}
                                            showRestore={true}
                                            showRadio={true}
                                            backupOnBeforeRestore={this.backupOnBeforeRestore}
                                            backupOnAfterRestore={this.backupOnAfterRestore}
                                        />
                                    </div>
                                    <div className={style.buttons}>
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            onClick={this.uninitializedStep}
                                            disabled={settingPassword}>
                                            {t('button.back')}
                                        </button>
                                    </div>
                                </Step> : ''}
                            {!unlockOnly && appStatus === 'restoreBackup' ?
                                <Step
                                    active={status !== 'initialized' && restoreBackupStatus === 'setPassword'}
                                    title={t('bitbox02Wizard.initialize.passwordTitle')}>
                                    {
                                        errorText && (
                                            <div className={style.standOut}>
                                                <img src={alertOctagon} />
                                                <span className={style.error}>{errorText}</span>
                                            </div>
                                        )
                                    }
                                    <div className={style.stepContext}>
                                        <p>{t('bitbox02Wizard.initialize.passwordText')}</p>
                                    </div>
                                    <div className={style.passwordGesturesGifWrapper}>
                                        <img class={style.passwordGesturesGif} src={passwordEntryGif}/>
                                    </div>
                                </Step> : ''}
                            <Step
                                active={status === 'initialized'}
                                title={t('bitbox02Wizard.success.title')}>
                                <div className={style.stepContext}>
                                    <p>{t('bitbox02Wizard.success.text')}</p>
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
