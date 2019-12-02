/**
 * Copyright 2019 Shift Devices AG
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
import { alertUser } from '../../components/alert/Alert';
import { UnlockBitBoxBase } from '../../components/bitboxbase/unlockbitboxbase';
import { confirmation } from '../../components/confirm/Confirm';
import { Button, Input } from '../../components/forms';
import { SwissMadeOpenSource } from '../../components/icon';
import { Header } from '../../components/layout/header';
import { PasswordRepeatInput } from '../../components/password';
import { Spinner } from '../../components/spinner/Spinner';
import { Step, Steps } from '../../components/steps';
import * as stepStyle from '../../components/steps/steps.css';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import '../../style/animate.css';
import { apiSubscribe } from '../../utils/event';
import { apiGet, apiPost } from '../../utils/request';
import SimpleMarkup from '../../utils/simplemarkup';
import { BaseSettings } from './basesettings';
import * as style from './bitboxbase.css';
import { baseStore, BaseUserStatus, RegisteredBaseFields, SharedProps as SharedBaseProps } from './bitboxbaseconnect';

export interface BitBoxBaseProps {
    bitboxBaseID: string | null;
}

export interface BitBoxBaseInfo {
    status: string;
    hostname: string;
    middlewareLocalIP: string;
    middlewareLocalPort: string;
    middlewareTorOnion: string;
    middlewareTorPort: string;
    isTorEnabled: boolean;
    isBitcoindListening: boolean;
    IsSSHPasswordLoginEnabled: boolean;
    freeDiskspace: number;
    totalDiskspace: number;
    baseVersion: string;
    bitcoindVersion: string;
    lightningdVersion: string;
    electrsVersion: string;
}

export interface BitBoxBaseServiceInfo {
    bitcoindBlocks: number;
    bitcoindHeaders: number;
    bitcoindVerificationProgress: number;
    bitcoindPeers: number;
    bitcoindIBD: boolean;
    lightningdBlocks: number;
    lightningActiveChannels: number;
    electrsBlocks: number;
}

export type InternalBaseStatus = '' | 'connected' | 'unpaired' | 'pairingFailed' | 'passwordNotSet' | 'bitcoinPre' | 'locked' | 'initialized' | 'disconnected' | 'connectionLost' | 'reconnecting' | 'offline';

export interface BaseUpdateInfo {
    description: string;
    version: string;
    severity: string;
}

const initSharedBaseState = (baseID: string) => {
    const initialStatus: InternalBaseStatus = '';
    const initialUserStatus: BaseUserStatus = '';
    const initialState = {[baseID]: {
        paired: false,
        internalStatus: initialStatus,
        userStatus: initialUserStatus,
        hostname: '',
    }};
    baseStore.setState({registeredBases: initialState});
};

export const updateSharedBaseState = <K extends keyof RegisteredBaseFields>(key: K, value: RegisteredBaseFields[K], baseID: string) => {
    if (!(baseID in baseStore.state.registeredBases)) {
        initSharedBaseState(baseID);
    }
    const newState = Object.assign({}, baseStore.state);
    newState.registeredBases[baseID][key] = value;
    baseStore.setState(newState);
};

export const setInternalBaseStatus = (internalStatus: InternalBaseStatus, IP: string) => {
    updateSharedBaseState('internalStatus', internalStatus, IP);
};

export const setBaseUserStatus = (userStatus: BaseUserStatus, IP: string) => {
    updateSharedBaseState('userStatus', userStatus, IP);
};

export const statusBadgeColor = (baseID: string): string => {
    if (!baseStore.state.registeredBases[baseID]) {
        return 'offline';
    }
    switch (baseStore.state.registeredBases[baseID].userStatus) {
        case 'Unpaired':
        case 'Busy':
        case 'Restarting':
            return 'busy';
        case 'OK':
            return 'online';
        case 'Warning':
            return 'warning';
        case 'Error':
            return 'error';
        default:
            return 'offline';
    }
};

const defaultPassword = 'ICanHasPasword?';

enum ActiveStep {
    PairingCode,
    SetPassword,
    ChooseSetup,
    ChooseName,
    ChooseSyncingOption,
    ChooseNetwork,
    Backup,
    BackupCreated,
    Ready,
}

// SyncingOptions correspond to API endpoints in the handlers
enum SyncingOptions {
    Resync = 'resync-bitcoin',
    Reindex = 'reindex-bitcoin',
    Presync = 'presync', // the Base starts presynced by default so this is not an API call
}

// NetworkOptions correspond to API endpoints in the handlers
enum NetworkOptions {
    EnableTor = 'enable-tor',
    ClearnetIBD = 'enable-clearnet-ibd',
}

// Displays one-letter-wide blocks as placeholders if pairing code not available yet
const noPairingPlaceholder = '\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588\n' +
                             '\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588';

interface State {
    baseInfo?: BitBoxBaseInfo;
    serviceInfo?: BitBoxBaseServiceInfo;
    bitboxBaseID: string;
    bitboxBaseVerified: boolean;
    hash?: string;
    showWizard: boolean;
    activeStep?: ActiveStep;
    password?: string;
    hostname?: string;
    validHostname?: boolean;
    syncingOption?: SyncingOptions;
    locked: boolean;
    updateAvailable?: boolean;
    updateInfo?: BaseUpdateInfo;
    inProgress: boolean;
}

type Props = BitBoxBaseProps & SharedBaseProps & TranslateProps;

class BitBoxBase extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            baseInfo: undefined,
            serviceInfo: undefined,
            bitboxBaseID: '',
            bitboxBaseVerified: false,
            showWizard: false,
            activeStep: ActiveStep.PairingCode,
            password: undefined,
            hostname: undefined,
            validHostname: false,
            syncingOption: undefined,
            locked: this.props.bitboxBaseID ? baseStore.state.registeredBases[this.props.bitboxBaseID].internalStatus === 'locked' : true,
            updateAvailable: undefined,
            updateInfo: undefined,
            inProgress: false,
        };
    }

    private unsubscribe!: () => void;

    public componentDidMount() {
        this.onChannelHashChanged();
        this.onStatusChanged();
        this.unsubscribe = apiSubscribe('/' + this.apiPrefix() + '/event', ({ object }) => {
            switch (object) {
                case 'statusChanged':
                    this.onStatusChanged();
                    break;
                case 'channelHashChanged':
                    this.onChannelHashChanged();
                    break;
                case 'serviceInfoChanged':
                    this.getServiceInfo();
                    break;
                case 'disconnect':
                    this.onDisconnect();
                    break;
                case 'userAuthenticated':
                    this.onUserAuthenticated();
                    break;
                case 'updateAvailable':
                    this.onUpdateAvailable();
                    break;
                case 'connectionLost':
                    // the 'connectionLost' event is emitted whenever the connection closes, but here we want to notify
                    // the user only if it happened unexpectedly
                    if (!['Disconnected', 'Unpaired', 'Offline', 'Restarting'].includes(baseStore.state.registeredBases[this.state.bitboxBaseID].userStatus)) {
                        alertUser('BitBoxBase connection lost');
                        setBaseUserStatus('Connection lost', this.state.bitboxBaseID);
                    }
                    break;
                default:
                    break;
            }
        });

        // Only create a new websocket if the bitboxBaseID changed.
        if (this.props.bitboxBaseID !== this.state.bitboxBaseID && this.props.bitboxBaseID) {
            this.setState({ bitboxBaseID : this.props.bitboxBaseID});
        }
    }

    public componentWillUnmount() {
        this.unsubscribe();
    }

    private apiPrefix = () => {
        return 'bitboxbases/' + this.props.bitboxBaseID;
    }

    private onChannelHashChanged = () => {
        apiGet(this.apiPrefix() + '/channel-hash').then(({ hash, bitboxBaseVerified }) => {
            this.setState({ hash, bitboxBaseVerified });
        });
    }

    private onStatusChanged = () => {
        apiGet(this.apiPrefix() + '/status').then(({status}) => {
            if (!this.state.showWizard && ['unpaired', 'pairingFailed', 'passwordNotSet', 'bitcoinPre'].includes(status)) {
                this.setState({ showWizard: true });
            }
            const prevStatus = baseStore.state.registeredBases[this.state.bitboxBaseID].internalStatus;
            setInternalBaseStatus(status, this.state.bitboxBaseID);
            // check if the base middleware password has been set yet
            switch (baseStore.state.registeredBases[this.state.bitboxBaseID].internalStatus) {
                case 'unpaired':
                    setBaseUserStatus('Unpaired', this.state.bitboxBaseID);
                    break;
                case 'disconnected':
                    setBaseUserStatus('Disconnected', this.state.bitboxBaseID);
                    break;
                case 'reconnecting':
                    setBaseUserStatus('Restarting', this.state.bitboxBaseID);
                    break;
                case 'offline':
                    setBaseUserStatus('Offline', this.state.bitboxBaseID);
                    break;
                case 'passwordNotSet':
                    // Advance automatically to the change password screen only if noise pairing had already succeeded
                    if (prevStatus === 'unpaired') {
                        break;
                    }
                    this.setState({activeStep: ActiveStep.SetPassword});
                    break;
                case 'bitcoinPre':
                    this.setState({activeStep: ActiveStep.ChooseSetup});
                    break;
                case 'locked':
                    // Advance automatically to the enter password screen only if noise pairing had already succeeded
                    if (prevStatus === 'unpaired') {
                        this.setState({
                            locked: true,
                        });
                        break;
                    }
                    this.setState({
                        locked: true,
                        showWizard: false,
                    });
                    setBaseUserStatus('OK', this.state.bitboxBaseID);
                    break;
                case 'initialized':
                    // If we are at the last step of the wizard, don't go to the dashboard yet
                    if (this.state.activeStep === ActiveStep.BackupCreated) {
                        this.setState({
                            locked: false,
                        });
                    } else {
                        this.setState({
                            locked: false,
                            showWizard: false,
                        });
                        this.getBaseInfo();
                        this.getServiceInfo();
                    }
                    setBaseUserStatus('OK', this.state.bitboxBaseID);
                    break;
                default:
                    break;
            }
        });
    }

    private getServiceInfo = () => {
        apiGet(this.apiPrefix() + '/service-info').then(({success, serviceInfo}) => {
            if (success) {
                this.setState({ serviceInfo });
            }
        });
    }

    private getBaseInfo = () => {
        apiGet(this.apiPrefix() + '/base-info').then(({ success, baseInfo }) => {
            if (success && this.props.bitboxBaseID) {
                this.setState({ baseInfo });
                updateSharedBaseState('hostname', baseInfo.hostname, this.state.bitboxBaseID);
            }
        });
    }

    private getUpdateInfo = () => {
        apiGet(this.apiPrefix() + '/update-info')
        .then(response => {
            if (response.success) {
                this.setState({
                    updateAvailable: response.available,
                    updateInfo: response.info,
                });
            } else {
                alertUser(response.message);
            }
        });
    }

    private onUserAuthenticated = () => {
        // When a user authenticates, authenticated RPC calls are now available, so we can fetch the base info
        this.getBaseInfo();
        this.getServiceInfo();
        this.getUpdateInfo();
    }

    private connectElectrum = () => {
        apiPost(this.apiPrefix() + '/connect-electrum', {
            bitboxBaseID : this.props.bitboxBaseID,
        }).then(({success}) => {
            if (!success) {
                alertUser(success.errorMessage);
            }
        });
    }

    private removeBitBoxBase = () => {
        apiPost(this.apiPrefix() + '/disconnect', {
            bitboxBaseID : this.props.bitboxBaseID,
        }).then(({ success }) => {
            if (!success) {
                alertUser('Did not work');
            } else {
                this.onDisconnect();
            }
        });
    }

    private setPassword = (password: string) => {
        this.setState({ password });
    }

    private submitChangePasswordSetup = (event: Event) => {
        event.preventDefault();
        this.setState({ inProgress: true });
        apiPost(this.apiPrefix() + '/user-change-password', {username: 'admin', password: defaultPassword, newPassword: this.state.password})
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.ChooseSetup });
            } else {
                // TODO: Once error codes are implemented on the base, add them with corresponding text to app.json for translation
                alertUser(response.message);
            }
            this.setState({ inProgress: false });
        });
    }

    private handleNameInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        const hostname: string = target.value;
        if (hostname.match('^[a-z][a-z0-9-]{0,22}[a-z0-9]$') !== null) {
            this.setState({ hostname, validHostname: true });
        } else {
            this.setState({ validHostname: false });
        }
    }

    private setHostname = () => {
        this.setState({ inProgress: true });
        apiPost(this.apiPrefix() + '/set-hostname', {hostname: this.state.hostname})
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.ChooseSyncingOption });
            } else {
                alertUser(response.message);
            }
            this.setState({ inProgress: false });
        });
    }

    private setNetwork = (networkOption: NetworkOptions, toggleSetting: boolean) => {
        this.setState({ inProgress: true });
        apiPost(this.apiPrefix() + `/${networkOption}`, toggleSetting)
        .then(response => {
            if (response.success) {
                if (this.state.syncingOption === SyncingOptions.Presync) {
                    this.setState({ activeStep: ActiveStep.Backup });
                } else {
                    this.setSyncingOption();
                }
            } else {
                alertUser(response.message);
            }
            this.setState({ inProgress: false });
        });
    }

    private setSyncingOption = () => {
        if (this.state.syncingOption) {
            apiPost(this.apiPrefix() + `/${this.state.syncingOption}`)
            .then(response => {
                if (response.success) {
                    this.setState({ activeStep: ActiveStep.Backup });
                } else {
                    alertUser(response.message);
                }
            });
        } else {
            alertUser(this.props.t('bitboxBaseWizard.errors.networkSetting'));
        }
    }

    private createBackup = () => {
        this.setState({ inProgress: true });
        apiPost(this.apiPrefix() + '/backup-sysconfig')
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.BackupCreated });
                this.finalizeSetup();
            } else {
                alertUser(response.message);
                this.setState({ inProgress: false });
            }
        });
    }

    private finalizeSetup = () => {
        apiPost(this.apiPrefix() + '/finalize-setup-wizard')
        .then(response => {
            if (!response.success) {
                alertUser(response.message);
            }
            this.getBaseInfo();
            this.getServiceInfo();
            this.setState({ inProgress: false });
        });
    }

    private onUpdateAvailable = () => {
        this.getUpdateInfo();
    }

    private onDisconnect = () => {
        route('/bitboxbase', true);
    }

    public render(
        {
            t,
        }: RenderableProps<Props>,
        {
            bitboxBaseID,
            showWizard,
            hash,
            activeStep,
            password,
            validHostname,
            locked,
            syncingOption,
            baseInfo,
            serviceInfo,
            updateAvailable,
            updateInfo,
            inProgress,
        }: State,
    ) {
        // TODO: Move wizard to basewizard.tsx and refactor
        if (!showWizard) {
            if (locked) {
                return (
                    <UnlockBitBoxBase bitboxBaseID={bitboxBaseID}/>
                );
            }

            if (baseInfo) {
                return (
                    <BaseSettings
                        baseID={bitboxBaseID}
                        baseInfo={baseInfo}
                        serviceInfo={serviceInfo}
                        disconnect={this.removeBitBoxBase}
                        connectElectrum={this.connectElectrum}
                        apiPrefix={this.apiPrefix()}
                        updateAvailable={updateAvailable}
                        updateInfo={updateInfo}
                        getBaseInfo={this.getBaseInfo}
                        baseUserStatus={baseStore.state.registeredBases[this.state.bitboxBaseID].userStatus} />
                );
            }
            return (
                <div className="contentWithGuide">
                    <div className="container">
                        <Spinner text="Connecting your BitBoxBase" />
                    </div>
                </div>
            );
        }

        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('bitboxBaseWizard.welcome')}</h2>} />
                    <div className="flex flex-column flex-center flex-items-center flex-1 scrollableContainer">
                        <Steps>

                            <Step
                                title={t('bitboxBaseWizard.pairing.title')}
                                active={activeStep === ActiveStep.PairingCode}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p>{t('bitboxBaseWizard.pairing.unpaired')}</p>
                                    <pre className={!hash ? style.noHash : ''}>
                                        {hash ? hash : noPairingPlaceholder}
                                    </pre>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                        <Button
                                            primary
                                            disabled={bitboxBaseID && !baseStore.state.registeredBases[bitboxBaseID].paired}
                                            onClick={() => {
                                                // Go either to the set password screen or enter password screen
                                                // depending if password had already been set
                                                baseStore.state.registeredBases[bitboxBaseID].internalStatus === 'passwordNotSet' ?
                                                    this.setState({activeStep: ActiveStep.SetPassword}) :
                                                    this.setState({showWizard: false});
                                                }
                                            }>
                                            {t('bitbox02Wizard.pairing.confirmButton')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.setPassword')}
                                active={activeStep === ActiveStep.SetPassword}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <form onSubmit={this.submitChangePasswordSetup}>
                                        <PasswordRepeatInput
                                            label={t('initialize.input.label')}
                                            repeatLabel={t('initialize.input.labelRepeat')}
                                            showLabel=" "
                                            onValidPassword={this.setPassword} />
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                            <Button
                                                disabled={!password}
                                                primary
                                                type="submit">
                                                {t('dialog.confirm')}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.setup.title')}
                                active={activeStep === ActiveStep.ChooseSetup}
                                width={840}>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className="column column-1-2">
                                            <div className={stepStyle.stepContext}>
                                                <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.setup.quick.title')}</h3>
                                                <ul>
                                                    <li>{t('bitboxBaseWizard.setup.quick.point1')}</li>
                                                    <li>{t('bitboxBaseWizard.setup.quick.point2')}</li>
                                                    <li>{t('bitboxBaseWizard.setup.quick.point3')}</li>
                                                </ul>
                                                <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                                    <Button primary onClick={() => this.setState({ activeStep: ActiveStep.Backup })}>{t('bitboxBaseWizard.setup.quick.select')}</Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="column column-1-2">
                                            <div className={stepStyle.stepContext}>
                                                <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.setup.custom.title')}</h3>
                                                <ul>
                                                    <li>{t('bitboxBaseWizard.setup.custom.point1')}</li>
                                                    <li>{t('bitboxBaseWizard.setup.custom.point2')}</li>
                                                    <li>{t('bitboxBaseWizard.setup.custom.point3')}</li>
                                                </ul>
                                                <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                                    <Button primary onClick={() => this.setState({ activeStep: ActiveStep.ChooseName })}>{t('bitboxBaseWizard.setup.custom.select')}</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.hostname.title')}
                                active={activeStep === ActiveStep.ChooseName}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <Input
                                        className={stepStyle.wizardLabel}
                                        pattern="^[a-z0-9]+[a-z0-9-.]{0,62}[a-z0-9]$"
                                        label={t('bitboxBaseWizard.hostname.label')}
                                        placeholder={t('bitboxBaseWizard.hostname.placeholder')}
                                        type="text"
                                        title={t('bitboxBaseWizard.hostname.tooltip')}
                                        onInput={this.handleNameInput} />
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                        <Button
                                            primary
                                            onClick={this.setHostname}
                                            disabled={!validHostname || inProgress }>
                                            {t('button.continue')}
                                        </Button>
                                        <Button transparent onClick={() => this.setState({ activeStep: ActiveStep.ChooseSetup })}>{t('button.back')}</Button>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.bitcoin.title')}
                                active={activeStep === ActiveStep.ChooseSyncingOption}
                                large>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 480px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.bitcoin.presync')}</h3>
                                                    <p style="padding-bottom: 22px">{t('bitboxBaseWizard.bitcoin.presyncInfo.label')}</p>
                                                    <ul className={style.prosOptionsList}>
                                                        <li>{t('bitboxBaseWizard.bitcoin.presyncInfo.pro1')}</li>
                                                        <li>{t('bitboxBaseWizard.bitcoin.presyncInfo.pro2')}</li>
                                                    </ul>
                                                    <ul className={style.consOptionsList}>
                                                        <li>{t('bitboxBaseWizard.bitcoin.presyncInfo.con1')}</li>
                                                        <li>{t('bitboxBaseWizard.bitcoin.presyncInfo.con2')}</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => this.setState({ syncingOption: SyncingOptions.Presync, activeStep: ActiveStep.ChooseNetwork })}
                                                >
                                                    {t('button.select')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 480px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.bitcoin.reindex')}</h3>
                                                    <p style="padding-bottom: 22px">{t('bitboxBaseWizard.bitcoin.reindexInfo.label')}</p>
                                                    <ul className={style.prosOptionsList}>
                                                        <li>{t('bitboxBaseWizard.bitcoin.reindexInfo.pro1')}</li>
                                                    </ul>
                                                    <ul className={style.consOptionsList}>
                                                        <li>{t('bitboxBaseWizard.bitcoin.reindexInfo.con1')}</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => {                                   confirmation(t('bitboxBaseWizard.bitcoin.reindexInfo.warning'), result => {
                                                        if (result) {
                                                            this.setState({ syncingOption: SyncingOptions.Reindex, activeStep: ActiveStep.ChooseNetwork });
                                                        }
                                                    });
                                                }}>
                                                    {t('button.select')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 480px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.bitcoin.resync')}</h3>
                                                    <p>{t('bitboxBaseWizard.bitcoin.resyncInfo.label')}</p>
                                                    <ul className={style.prosOptionsList}>
                                                        <li>{t('bitboxBaseWizard.bitcoin.resyncInfo.pro1')}</li>
                                                    </ul>
                                                    <ul className={style.consOptionsList}>
                                                    <li>{t('bitboxBaseWizard.bitcoin.resyncInfo.con1')}</li>
                                                    <li>{t('bitboxBaseWizard.bitcoin.resyncInfo.con2')}</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => {
                                                    confirmation(t('bitboxBaseWizard.bitcoin.resyncInfo.warning'), result => {
                                                        if (result) {
                                                            this.setState({ syncingOption: SyncingOptions.Resync, activeStep: ActiveStep.ChooseNetwork });
                                                        }
                                                    });
                                                }}>
                                                    {t('button.select')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.networks.title')}
                                active={activeStep === ActiveStep.ChooseNetwork}
                                large>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className={['column', syncingOption === SyncingOptions.Resync ? 'column-1-3' : 'column-1-2'].join(' ')}>
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 490px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.networks.tor.title')}</h3>
                                                    {
                                                        syncingOption === SyncingOptions.Reindex
                                                        ?
                                                        <span>{t('bitboxBaseWizard.networks.tor.label1')}</span>
                                                        :
                                                        <p style={syncingOption === SyncingOptions.Resync && 'padding-bottom: 22px'}>
                                                            {t('bitboxBaseWizard.networks.tor.label2')}
                                                        </p>
                                                    }
                                                    <ul className={style.prosOptionsList}>
                                                        <li>{t('bitboxBaseWizard.networks.tor.pro1')}</li>
                                                        <li>{t('bitboxBaseWizard.networks.tor.pro2')}</li>
                                                        <li>{t('bitboxBaseWizard.networks.tor.pro3')}</li>
                                                    </ul>
                                                    <ul className={style.consOptionsList}>
                                                        {
                                                            syncingOption === SyncingOptions.Resync &&
                                                            <li>{t('bitboxBaseWizard.networks.tor.con1')}</li>
                                                        }
                                                        <li>{t('bitboxBaseWizard.networks.tor.con2')}</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0px !important">
                                                        <Button
                                                            primary
                                                            disabled={inProgress}
                                                            onClick={() => this.setNetwork(NetworkOptions.EnableTor, true)}>{t('bitboxBaseWizard.networks.tor.select')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {
                                            syncingOption === SyncingOptions.Resync &&
                                            <div className="column column-1-3">
                                                <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 490px">
                                                    <div>
                                                        <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.networks.clearnetThenTor.title')}</h3>
                                                        <p>{t('bitboxBaseWizard.networks.clearnetThenTor.label')}</p>
                                                        <ul className={style.prosOptionsList}>
                                                            <li>{t('bitboxBaseWizard.networks.clearnetThenTor.pro1')}</li>
                                                            <li>{t('bitboxBaseWizard.networks.clearnetThenTor.pro2')}</li>
                                                        </ul>
                                                        <ul className={style.consOptionsList}>
                                                            <li>{t('bitboxBaseWizard.networks.clearnetThenTor.con1')}</li>
                                                        </ul>
                                                    </div>
                                                    <Button
                                                        primary
                                                        disabled={inProgress}
                                                        onClick={() => this.setNetwork(NetworkOptions.ClearnetIBD, true)}>{t('bitboxBaseWizard.networks.clearnetThenTor.select')}
                                                    </Button>
                                                </div>
                                            </div>
                                        }
                                        <div className={['column', syncingOption === SyncingOptions.Resync ? 'column-1-3' : 'column-1-2'].join(' ')}>
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 490px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>{t('bitboxBaseWizard.networks.clearnet.title')}</h3>
                                                    <span>{t('bitboxBaseWizard.networks.clearnet.label')}</span>
                                                    <ul className={style.prosOptionsList}>
                                                        <li>{t('bitboxBaseWizard.networks.clearnet.pro1')}</li>
                                                        <li>{t('bitboxBaseWizard.networks.clearnet.pro2')}</li>
                                                        <li>{t('bitboxBaseWizard.networks.clearnet.pro3')}</li>
                                                    </ul>
                                                    <ul className={style.consOptionsList}>
                                                        <li>{t('bitboxBaseWizard.networks.clearnet.con1')}</li>
                                                        <li>{t('bitboxBaseWizard.networks.clearnet.con2')}</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0px !important">
                                                        <Button
                                                            primary
                                                            disabled={inProgress}
                                                            onClick={() => this.setNetwork(NetworkOptions.EnableTor, false)}>{t('bitboxBaseWizard.networks.clearnet.select')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.backups.title')}
                                active={activeStep === ActiveStep.Backup}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p>{t('bitboxBaseWizard.backups.insert')}</p>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                        <Button
                                            primary
                                            disabled={inProgress}
                                            onClick={() => this.createBackup()}>
                                            {inProgress ? t('bitboxBase.settings.backups.creating') : t('bitboxBase.settings.backups.create')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.backups.createdTitle')}
                                active={activeStep === ActiveStep.BackupCreated}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <SimpleMarkup tagName="p" markup={t('bitboxBaseWizard.backups.created')} />
                                    <ul className={style.consOptionsList}>
                                        <li>{t('bitboxBaseWizard.backups.list.point1')}</li>
                                        <li>{t('bitboxBaseWizard.backups.list.point2')}</li>
                                        <SimpleMarkup tagName="li" markup={t('bitboxBaseWizard.backups.list.point3')} />
                                    </ul>
                                    <SimpleMarkup tagName="p" markup={t('bitboxBaseWizard.backups.finalizing')} />
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                        <Button
                                            primary
                                            disabled={inProgress}
                                            onClick={() => this.setState({ activeStep: ActiveStep.Ready })}>
                                            {inProgress ? t('bitboxBaseWizard.backups.createdTitle') : t('button.continue')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                            <Step
                                title={t('bitboxBaseWizard.success.title')}
                                active={activeStep === ActiveStep.Ready}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p className="text-center">{t('bitboxBaseWizard.success.text')}</p>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                        <Button
                                            primary
                                            onClick={() => this.setState({ showWizard: false, activeStep: ActiveStep.PairingCode })}>
                                            {t('bitboxBaseWizard.success.button')}
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-center m-top-default">
                                    <SwissMadeOpenSource large />
                                </div>
                            </Step>

                        </Steps>
                    </div>
                </div>
            </div>
        );
    }
}

const SharedBitBoxBase = share<SharedBaseProps, BitBoxBaseProps & TranslateProps>(baseStore)(BitBoxBase);
const TranslatedBitBoxBase = translate<BitBoxBaseProps>()(SharedBitBoxBase);
export { TranslatedBitBoxBase as BitBoxBase };
