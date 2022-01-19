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

import React, { Component, FunctionComponent, useEffect, useState } from 'react';
import { Backup, BackupsListItem } from '../components/backup';
import { route } from '../../../utils/route';
import warning from '../../../assets/icons/warning.png';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button, Checkbox, Input  } from '../../../components/forms';
import { Step, Steps } from './components/steps';
import { View, ViewContent, ViewHeader } from '../../../components/view/view';
import style from './components/steps/steps.module.css';
import Toast from '../../../components/toast/Toast';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../../components/alert/Alert';
import { store as panelStore } from '../../../components/guide/guide';
import { SwissMadeOpenSource } from '../../../components/icon/logo';
import { setSidebarStatus } from '../../../components/sidebar/sidebar';
import Status from '../../../components/status/status';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import { PasswordEntry } from './components/password-entry/password-entry';
import { BackupsV2 } from './backups';
import { Settings } from './settings';
import { UpgradeButton, VersionInfo } from './upgradebutton';
import { useTranslation } from 'react-i18next';
import { DeviceInfo } from '../../../api/bitbox02';

interface UnlockStepProps {
    attestationResult: boolean | null;
    deviceID: string;
}

const getDeviceInfoMock = async (_deviceID: string) => {
    return ({
        name: 'placeholderName'
    } as DeviceInfo);
}

const UnlockStep: FunctionComponent<UnlockStepProps> = ({ attestationResult, deviceID }) => {
    const { t } = useTranslation();
    const [info, setInfo] = useState<DeviceInfo>();

    useEffect(() => {
        // change to getDeviceInfo on unmmock and remove mock function.
        getDeviceInfoMock(deviceID).then(setInfo);
    }, [deviceID]);

    return (
        <View
            fullscreen
            textCenter
            withBottomBar
            width="600px">
            <ViewHeader title={t('button.unlock')}>
                <p className="text-center">
                    {t('bitbox02Wizard.stepConnected.unlock')}
                    {info && info.name && <b> {info.name}</b>}
                </p>
            </ViewHeader>
            <ViewContent fullWidth>
                {/* the view component covers all other banners
                i.e. the attestation warning at the top,
                that is why added it there as well instead of
                the password guesture. */}
                {attestationResult === false ? (
                    <Status>
                        {t('bitbox02Wizard.attestationFailed')}
                    </Status>
                ) : (
                    <PasswordEntry />
                )}
            </ViewContent>
        </View>
    )
}

interface BitBox02Props {
    deviceID: string;
}

type Props = BitBox02Props & TranslateProps;

interface State {
    versionInfo?: VersionInfo;
    hash?: string;
    attestationResult: boolean | null;
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
    sdCardInserted?: boolean;
    errorText?: string;
    deviceName: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    agreement1: boolean;
    agreement2: boolean;
    agreement3: boolean;
    agreement4: boolean;
    agreement5: boolean;
    waitDialog?: {
        title: string;
        text?: string;
    };
    selectedBackup?: Backup;
}

class BitBox02 extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            attestationResult: null,
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
            agreement1: false,
            agreement2: false,
            agreement3: false,
            agreement4: false,
            agreement5: false,
            waitDialog: undefined,
        };
    }

    private unsubscribe!: () => void;

    public UNSAFE_componentWillMount() {
        const { sidebarStatus } = panelStore.state;
        if (['', 'forceCollapsed'].includes(sidebarStatus)) {
            setSidebarStatus('forceHidden');
        }
    }

    public componentDidMount() {
        apiGet(this.apiPrefix() + '/version').then(versionInfo => {
            this.setState({ versionInfo });
        });
        this.updateAttestationCheck();
        this.checkSDCard().then(sdCardInserted => {
            this.setState({ sdCardInserted });
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
                        case 'attestationCheckDone':
                            this.updateAttestationCheck();
                            break;
                    }
                    break;
            }
        });
    }

    private updateAttestationCheck = () => {
        apiGet(this.apiPrefix() + '/attestation').then(attestationResult => {
            this.setState({ attestationResult });
        });
    }

    private apiPrefix = () => {
        return 'devices/bitbox02/' + this.props.deviceID;
    }

    private handleGetStarted = () => {
        route('/account-summary', true);
    }

    private onChannelHashChanged = () => {
        apiGet(this.apiPrefix() + '/channel-hash').then(({ hash, deviceVerified }) => {
            this.setState({ hash, deviceVerified });
        });
    }

    private onStatusChanged = () => {
        const { showWizard, unlockOnly, appStatus } = this.state;
        const { sidebarStatus } = panelStore.state;
        apiGet(this.apiPrefix() + '/status').then(status => {
            const restoreSidebar = status === 'initialized' && !['createWallet', 'restoreBackup'].includes(appStatus) && sidebarStatus !== '';
            if (restoreSidebar) {
                setSidebarStatus('');
            } else if (status !== 'initialized' && ['', 'forceCollapsed'].includes(sidebarStatus)) {
                setSidebarStatus('forceHidden');
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
                // bitbox is unlocked, now route to / and wait for incoming accounts
                route('/', true);
            }
        });
    }

    public componentWillUnmount() {
        const { sidebarStatus } = panelStore.state;
        if (['forceHidden', 'forceCollapsed'].includes(sidebarStatus)) {
            setSidebarStatus('');
        }
        this.unsubscribe();
    }

    private channelVerify = ok => {
        apiPost(this.apiPrefix() + '/channel-hash-verify', ok);
    }

    private uninitializedStep = () => {
        this.setState({ appStatus: '' });
    }

    private createWalletStep = () => {
        this.checkSDCard().then(sdCardInserted => {
            this.setState({ sdCardInserted });
        });
        this.setState({ appStatus: 'createWallet' });
    }

    private restoreBackupStep = () => {
        this.insertSDCard().then(success => {
            if (success) {
                this.setState({
                    appStatus: 'restoreBackup',
                    restoreBackupStatus: 'restore',
                });
            }
        });
    }

    private checkSDCard = () => {
        return apiGet('devices/bitbox02/' + this.props.deviceID + '/check-sdcard').then(sdCardInserted => {
            return sdCardInserted;
        });
    }

    private insertSDCard = () => {
        return this.checkSDCard().then(sdCardInserted => {
            this.setState({ sdCardInserted });
            if (sdCardInserted) {
                return true;
            }
            this.setState({ waitDialog: {
                title: this.props.t('bitbox02Wizard.stepInsertSD.insertSDcardTitle'),
                text: this.props.t('bitbox02Wizard.stepInsertSD.insertSDCard'),
            } });
            return apiPost('devices/bitbox02/' + this.props.deviceID + '/insert-sdcard').then(({ success, errorMessage }) => {
                this.setState({ sdCardInserted: success, waitDialog: undefined });
                if (success) {
                    return true;
                }
                if (errorMessage) {
                    alertUser(errorMessage);
                }
                return false;
            });
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
                    errorText: this.props.t('bitbox02Wizard.noPasswordMatch'),
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

    private backupOnBeforeRestore = (backup: Backup) => {
        this.setState({
            restoreBackupStatus: 'setPassword',
            selectedBackup: backup,
        });
    }

    private backupOnAfterRestore = (success: boolean) => {
        if (!success) {
            this.restoreBackup();
        }
        this.setState({ selectedBackup: undefined });
    }

    private createBackup = () => {
        this.insertSDCard().then(success1 => {
            if (!success1) {
                alertUser(this.props.t('bitbox02Wizard.createBackupFailed'));
                return;
            }

            this.setState({ creatingBackup: true, waitDialog: {
                title: this.props.t('bitbox02Interact.confirmDate'),
                text: this.props.t('bitbox02Interact.confirmDateText'),
            } });
            apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
                if (!success) {
                    alertUser(this.props.t('bitbox02Wizard.createBackupFailed'));
                }
                this.setState({ creatingBackup: false, waitDialog: undefined });
            });
        });
    }

    private handleDeviceNameInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        const value: string = target.value;
        this.setState({ deviceName: value });
    }

    private setDeviceName = () => {
        this.setState({ waitDialog: { title: this.props.t('bitbox02Interact.confirmName') } });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/set-device-name', { name: this.state.deviceName })
        .then(result => {
            this.setState({ waitDialog: undefined });
            if (result.success) {
                this.setPassword();
            } else if (result.message) {
                alertUser(result.message);
            }
        });
    }

    private restoreFromMnemonic = () => {
        this.setState({ waitDialog: {
            title: this.props.t('bitbox02Interact.followInstructions'),
            text: this.props.t('bitbox02Interact.followInstructionsMnemonic'),
        } });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/restore-from-mnemonic').then(({ success }) => {
            if (!success) {
                alertUser(this.props.t('bitbox02Wizard.restoreFromMnemonic.failed'));
            } else {
                this.setState({
                    appStatus: 'restoreFromMnemonic',
                });
            }
            this.setState({
                waitDialog: undefined,
            });
        });
    }

    private handleDisclaimerCheck = (event: React.SyntheticEvent) => {
        const target = event.target as HTMLInputElement;
        const key = target.id as 'agreement1' | 'agreement2' | 'agreement3' | 'agreement4' | 'agreement5';
        const obj = {};
        obj[key] = target.checked;
        this.setState(obj);
    }

    public render() {
        const { t, deviceID } = this.props;
        const {
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
            errorText,
            unlockOnly,
            showWizard,
            sdCardInserted,
            deviceName,
            agreement1,
            agreement2,
            agreement3,
            agreement4,
            agreement5,
            waitDialog,
        } = this.state;
        if (status === '') {
            return null;
        }
        if (!versionInfo) {
            return null;
        }
        if (status === 'require_firmware_upgrade') {
            return (
                <CenteredContent>
                    <div className="box large">
                        <p>{t('upgradeFirmware.label')}</p>
                        <div className="buttons">
                            <UpgradeButton
                                asButton
                                apiPrefix={this.apiPrefix()}
                                versionInfo={versionInfo}
                            />
                        </div>
                    </div>
                </CenteredContent>
            );
        }
        if (status === 'require_app_upgrade') {
            return <AppUpgradeRequired/>;
        }
        if (!showWizard) {
            return <Settings deviceID={deviceID}/>;
        }
        const readDisclaimers = agreement1 && agreement2 && agreement3 && agreement4 && agreement5;
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
                    <Status hidden={attestationResult !== false}>
                        {t('bitbox02Wizard.attestationFailed')}
                    </Status>
                    <div className="flex flex-1 scrollableContainer">
                        <Steps>
                            { (status === 'connected') ? (
                                <UnlockStep
                                    attestationResult={attestationResult}
                                    deviceID={deviceID} 
                                    key="unlock" />
                            ) : null }

                            <Step
                                key="failed-pairing"
                                active={status === 'unpaired' || status === 'pairingFailed'}
                                title={t('bitbox02Wizard.pairing.title')}>
                                {
                                    status === 'pairingFailed' && (
                                        <Toast theme="warning">
                                            <span>{t('bitbox02Wizard.pairing.failed')}</span>
                                        </Toast>
                                    )
                                }
                                <div className={[style.stepContext, status === 'pairingFailed' ? style.disabled : ''].join(' ')}>
                                    <p>{t('bitbox02Wizard.stepUnpaired.verify')}</p>
                                    <pre>{hash}</pre>
                                    {
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    onClick={() => this.channelVerify(true)}
                                                    disabled={!deviceVerified}>
                                                    {t('bitbox02Wizard.pairing.confirmButton')}
                                                </Button>
                                            </div>
                                    }
                                </div>
                                <div className="text-center m-top-large">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            {
                                !unlockOnly && (
                                    <Step
                                        key="uninitialized-pairing"
                                        active={status === 'uninitialized' && appStatus === ''}
                                        title={t('bitbox02Wizard.stepUninitialized.title')}
                                        large>
                                        <Toast theme="info">
                                            <div className="flex flex-items-center">
                                                <img src={warning} style={{width: 18, marginRight: 10}} />
                                                {t('bitbox02Wizard.initialize.tip')}
                                            </div>
                                        </Toast>
                                        <div className="columnsContainer m-top-default">
                                            <div className="columns">
                                                <div className="column column-1-2">
                                                    <div className={style.stepContext} style={{minHeight: 330}}>
                                                        <h3 className={style.stepSubHeader}>{t('button.create')}</h3>
                                                        <p className="text-center">{t('bitbox02Wizard.stepUninitialized.create')}</p>
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
                                                    <div className={style.stepContext} style={{minHeight: 330}}>
                                                        <h3 className={style.stepSubHeader}>{t('button.restore')}</h3>
                                                        <p className="text-center">{t('bitbox02Wizard.stepUninitialized.restore')}</p>
                                                        <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                            <Button
                                                                primary
                                                                onClick={this.restoreBackupStep}>
                                                                {t('bitbox02Wizard.stepUninitialized.restoreMicroSD')}
                                                            </Button>
                                                            <Button
                                                                primary
                                                                onClick={this.restoreFromMnemonic}>
                                                                {t('bitbox02Wizard.stepUninitialized.restoreMnemonic')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                !unlockOnly && appStatus === 'createWallet' && (
                                    <Step
                                        key="intro-pairing"
                                        active={createWalletStatus === 'intro'}
                                        title={t('bitbox02Wizard.stepCreate.title')}>
                                        {
                                            !sdCardInserted && (
                                                <Toast theme="info">
                                                    <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
                                                </Toast>
                                            )
                                        }
                                        <div className={style.stepContext}>
                                            <Input
                                                className={style.wizardLabel}
                                                label={t('bitbox02Wizard.stepCreate.nameLabel')}
                                                pattern="^.{0,63}$"
                                                onInput={this.handleDeviceNameInput}
                                                placeholder={t('bitbox02Wizard.stepCreate.namePlaceholder')}
                                                value={deviceName}
                                                id="deviceName"
                                            />
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    disabled={!deviceName}
                                                    onClick={this.setDeviceName}>
                                                    {t('bitbox02Wizard.stepCreate.buttonContinue')}
                                                </Button>
                                                <Button
                                                    transparent
                                                    onClick={() => this.setState({ appStatus: '' })}>
                                                    {t('bitbox02Wizard.stepCreate.buttonBack')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'createWallet') && (
                                    <Step
                                        key="create-wallet"
                                        width={700}
                                        active={createWalletStatus === 'setPassword'}
                                        title={t('bitbox02Wizard.stepPassword.title')}>
                                        <div className={style.stepContext}>
                                            {
                                                errorText && (
                                                    <Toast theme="warning">
                                                        <span className={style.error}>{errorText}</span>
                                                    </Toast>
                                                )
                                            }
                                            <p className="text-center">{t('bitbox02Wizard.stepPassword.useControls')}</p>
                                            <PasswordEntry />
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'createWallet') && (
                                    <Step
                                        key="create-backup"
                                        width={700}
                                        active={status === 'seeded' && createWalletStatus === 'createBackup'}
                                        title={t('backup.create.title')}>
                                        <div className={style.stepContext}>
                                            <p>{t('bitbox02Wizard.stepBackup.createBackup')}</p>
                                            <p className="m-bottom-default">{t('bitbox02Wizard.stepBackup.beforeProceed')}</p>
                                            <form>
                                                <div className="m-top-quarter">
                                                    <Checkbox
                                                        onChange={this.handleDisclaimerCheck}
                                                        className={style.wizardCheckbox}
                                                        id="agreement1"
                                                        checked={agreement1}
                                                        label={t('bitbox02Wizard.backup.userConfirmation1')} />
                                                </div>
                                                <div>
                                                    <Checkbox
                                                        onChange={this.handleDisclaimerCheck}
                                                        className={style.wizardCheckbox}
                                                        id="agreement2"
                                                        checked={agreement2}
                                                        label={t('bitbox02Wizard.backup.userConfirmation2')} />
                                                </div>
                                                <div className="m-top-quarter">
                                                    <Checkbox
                                                        onChange={this.handleDisclaimerCheck}
                                                        className={style.wizardCheckbox}
                                                        id="agreement3"
                                                        checked={agreement3}
                                                        label={t('bitbox02Wizard.backup.userConfirmation3')} />
                                                </div>
                                                <div className="m-top-quarter">
                                                    <Checkbox
                                                        onChange={this.handleDisclaimerCheck}
                                                        className={style.wizardCheckbox}
                                                        id="agreement4"
                                                        checked={agreement4}
                                                        label={t('bitbox02Wizard.backup.userConfirmation4')}/>
                                                </div>
                                                <div className="m-top-quarter">
                                                    <Checkbox
                                                        onChange={this.handleDisclaimerCheck}
                                                        className={style.wizardCheckbox}
                                                        id="agreement5"
                                                        checked={agreement5}
                                                        label={t('bitbox02Wizard.backup.userConfirmation5')}/>
                                                </div>
                                            </form>
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button
                                                    primary
                                                    onClick={this.createBackup}
                                                    disabled={creatingBackup || !readDisclaimers}>
                                                    {t('securityInformation.create.button')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                (!unlockOnly && appStatus === 'restoreBackup') && (
                                    <Step
                                        key="restore"
                                        width={700}
                                        active={status !== 'initialized' && restoreBackupStatus === 'restore'}
                                        title={t('backup.restore.confirmTitle')}>
                                        <BackupsV2
                                            deviceID={deviceID}
                                            showRestore={true}
                                            showRadio={true}
                                            backupOnBeforeRestore={this.backupOnBeforeRestore}
                                            backupOnAfterRestore={this.backupOnAfterRestore}>
                                            <Button
                                                transparent
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
                                        key="set-password"
                                        width={700}
                                        active={status !== 'initialized' && restoreBackupStatus === 'setPassword'}
                                        title={t('backup.restore.confirmTitle')}>
                                        <div className={style.stepContext}>
                                            {
                                                errorText && (
                                                    <Toast theme="warning">
                                                        {errorText}
                                                    </Toast>
                                                )
                                            }
                                            { this.state.selectedBackup ? (

                                                  <BackupsListItem
                                                      backup={this.state.selectedBackup}
                                                      handleChange={() => {}}
                                                      onFocus={() => {}}
                                                      radio={false} />
                                            ) : null }
                                            <p className="text-center">{t('bitbox02Wizard.stepPassword.useControls')}</p>
                                            <PasswordEntry />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                appStatus === 'createWallet' && (
                                    <Step
                                        key="success"
                                        active={status === 'initialized'}
                                        title={t('bitbox02Wizard.success.title')}>
                                        <div className={style.stepContext}>
                                            <p>{t('bitbox02Wizard.stepCreateSuccess.success')}</p>
                                            <p>{t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}</p>
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button primary onClick={this.handleGetStarted}>
                                                    {t('success.getstarted')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                appStatus === 'restoreBackup' && (
                                    <Step
                                        key="backup-success"
                                        width={700}
                                        active={status === 'initialized'}
                                        title={t('bitbox02Wizard.stepBackupSuccess.title')}>
                                        <div className={style.stepContext}>
                                            <p>{t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}</p>
                                            <p className="m-bottom-default">{t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}</p>
                                            <ul>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation2')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
                                            </ul>
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button primary onClick={this.handleGetStarted}>
                                                    {t('success.getstarted')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }

                            {
                                appStatus === 'restoreFromMnemonic' && (
                                    <Step
                                    key="backup-success2"
                                        width={700}
                                        active={status === 'initialized'}
                                        title={t('bitbox02Wizard.stepBackupSuccess.title')}>
                                        <div className={style.stepContext}>
                                        <p className="m-bottom-default">{t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}</p>
                                            <ul>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
                                                <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
                                            </ul>
                                            <div className={['buttons text-center', style.fullWidth].join(' ')}>
                                                <Button primary onClick={this.handleGetStarted}>
                                                    {t('success.getstarted')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-center m-top-large">
                                            <SwissMadeOpenSource large />
                                        </div>
                                    </Step>
                                )
                            }
                        </Steps>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate()(BitBox02);
export { HOC as BitBox02 };
