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
import { Header } from '../../components/layout/header';
import { PasswordRepeatInput } from '../../components/password';
import { Step, Steps } from '../../components/steps';
import * as stepStyle from '../../components/steps/steps.css';
import WaitDialog from '../../components/wait-dialog/wait-dialog';
import { translate, TranslateProps } from '../../decorators/translate';
import '../../style/animate.css';
import { apiSubscribe } from '../../utils/event';
import { apiGet, apiPost } from '../../utils/request';
import { BaseSettings } from './baseSettings';
import * as style from './bitboxbase.css';

export interface BitBoxBaseProps {
    bitboxBaseID: string | null;
}

export interface MiddlewareInfoType {
    blocks: number;
    difficulty: number;
    lightningAlias: string;
}

export interface VerificationProgressType {
    blocks: number;
    headers: number;
    verificationProgress: number;
}

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

interface State {
    middlewareInfo?: MiddlewareInfoType;
    verificationProgress?: VerificationProgressType;
    bitboxBaseID: string | null;
    bitboxBaseVerified: boolean;
    status: '' |
    'connected' |
    'unpaired' |
    'pairingFailed' |
    'passwordNotSet' |
    'bitcoinPre' |
    'locked' |
    'initialized';
    hash?: string;
    showWizard: boolean;
    activeStep?: ActiveStep;
    password?: string;
    hostname?: string;
    validHostname?: boolean;
    syncingOption?: SyncingOptions;
    waitDialog?: {
        title?: string;
        text?: string;
    };
    locked: boolean;
}

type Props = BitBoxBaseProps & TranslateProps;

class BitBoxBase extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            middlewareInfo: undefined,
            verificationProgress: undefined,
            bitboxBaseID: '',
            status: '',
            bitboxBaseVerified: false,
            showWizard: false,
            activeStep: ActiveStep.PairingCode,
            password: undefined,
            hostname: undefined,
            validHostname: false,
            syncingOption: undefined,
            waitDialog: undefined,
            locked: true,
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
                case 'sampleInfoChanged':
                    this.onNewMiddlewareInfo();
                    break;
                case 'verificationProgressChanged':
                    this.onNewVerificationProgress();
                case 'disconnect':
                    this.onDisconnect();
                    break;
                default:
                    break;
            }
        });

        // Only create a new websocket if the bitboxBaseID changed.
        if (this.props.bitboxBaseID !== this.state.bitboxBaseID) {
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
            if (!this.state.showWizard && ['connected', 'unpaired', 'pairingFailed', 'passwordNotSet', 'bitcoinPre'].includes(status)) {
                this.setState({ showWizard: true });
            }
            this.setState({
                status,
            });
            // check if the base middleware password has been set yet
            switch (this.state.status) {
                case 'passwordNotSet':
                    this.setState({activeStep: ActiveStep.SetPassword});
                    break;
                case 'bitcoinPre':
                    this.setState({activeStep: ActiveStep.ChooseSetup});
                    break;
                case 'locked':
                    this.setState({
                        locked: true,
                        showWizard: false,
                    });
                    break;
                case 'initialized':
                    this.setState({
                        locked: false,
                        showWizard: false,
                    });
                    this.onNewMiddlewareInfo();
                    this.onNewVerificationProgress();
                    break;
                default:
                    break;
            }
        });
    }

    private onNewMiddlewareInfo = () => {
        apiGet(this.apiPrefix() + '/middleware-info').then(({success, middlewareInfo}) => {
            if (success) {
                this.setState({ middlewareInfo });
            }
        });
    }

    private onNewVerificationProgress = () => {
        apiGet(this.apiPrefix() + '/verification-progress').then(({success, verificationProgress}) => {
            if (success) {
                this.setState({ verificationProgress });
            }
        });
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
        apiPost(this.apiPrefix() + '/user-change-password', {username: 'admin', password: defaultPassword, newPassword: this.state.password})
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.ChooseSetup });
            } else {
                // TODO: Once error codes are implemented on the base, add them with corresponding text to app.json for translation
                alertUser(response.message);
            }
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
        apiPost(this.apiPrefix() + '/set-hostname', {hostname: this.state.hostname})
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.ChooseSyncingOption });
            } else {
                alertUser(response.message);
            }
        });
    }

    private setNetwork = (networkOption: NetworkOptions, toggleSetting: boolean) => {
        this.setState({ waitDialog: {
            title: 'Getting everything ready',
            text: 'Configuring Network Settings...',
        }});
        apiPost(this.apiPrefix() + `/${networkOption}`, toggleSetting)
        .then(response => {
            if (response.success) {
                if (this.state.syncingOption === SyncingOptions.Presync) {
                    this.setState({ activeStep: ActiveStep.Backup, waitDialog: undefined });
                } else {
                    this.setSyncingOption();
                }
            } else {
                alertUser(response.message);
            }
        });
    }

    private setSyncingOption = () => {
        if (this.state.syncingOption) {
            this.setState({ waitDialog: {
                title: 'Getting everything ready',
                text: 'Configuring Synchronization Settings...',
            }});
            apiPost(this.apiPrefix() + `/${this.state.syncingOption}`)
            .then(response => {
                if (response.success) {
                    this.setState({ activeStep: ActiveStep.Backup, waitDialog: undefined });
                } else {
                    alertUser(response.message);
                }
            });
        } else {
            alertUser('No network setting found');
        }
    }

    private createBackup = () => {
        apiPost(this.apiPrefix() + '/backup-sysconfig')
        .then(response => {
            if (response.success) {
                this.setState({ activeStep: ActiveStep.BackupCreated });
            } else {
                alertUser(response.message);
            }
        });
    }

    private onDisconnect = () => {
        route('/bitboxbase', true);
    }

    public render(
        {
            t,
            bitboxBaseID,
        }: RenderableProps<Props>,
        {
            middlewareInfo,
            verificationProgress,
            showWizard,
            hash,
            activeStep,
            password,
            validHostname,
            waitDialog,
            locked,
            syncingOption,
        }: State,
    ) {
        if (!showWizard) {
            if (locked) {
                return (
                    <UnlockBitBoxBase bitboxBaseID={bitboxBaseID}/>
                );
            }
            if (!middlewareInfo) {
                return null;
            }
            if (!verificationProgress) {
                return null;
            }

            return (
                <BaseSettings
                    baseID={bitboxBaseID}
                    middlewareInfo={middlewareInfo}
                    verificationProgress={verificationProgress}
                    disconnect={this.removeBitBoxBase}
                    connectElectrum={this.connectElectrum} />
            );
        }

        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('welcome.title')}</h2>} />

                    {
                        waitDialog && (
                        <WaitDialog title={waitDialog.title}>
                            {waitDialog.text}
                        </WaitDialog>
                        )
                    }

                    <div className="flex flex-column flex-center flex-items-center flex-1 scrollableContainer">
                        <Steps>

                            <Step
                                title="Verify Pairing Code"
                                active={activeStep === ActiveStep.PairingCode}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p>{t('bitboxBaseWizard.pairing.unpaired')}</p>
                                    <pre>{hash}</pre>
                                </div>
                            </Step>

                            <Step
                                title="Set a Password"
                                active={activeStep === ActiveStep.SetPassword}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <form onSubmit={this.submitChangePasswordSetup}>
                                        <PasswordRepeatInput
                                            label={t('initialize.input.label')}
                                            repeatLabel={t('initialize.input.labelRepeat')}
                                            onValidPassword={this.setPassword} />
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                            <Button
                                                disabled={!password}
                                                primary
                                                type="submit">
                                                {t('initialize.create')}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </Step>

                            <Step
                                title="Choose Setup"
                                active={activeStep === ActiveStep.ChooseSetup}
                                large>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className="column column-1-2">
                                            <div className={stepStyle.stepContext}>
                                                <h3 className={stepStyle.stepSubHeader}>Quick</h3>
                                                <p>The quickest way to get started.</p>
                                                <ul>
                                                    <li>Starts from pre-synced blockchain</li>
                                                    <li>Uses Tor by default</li>
                                                    <li>Chooses default hostname</li>
                                                </ul>
                                                <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                                    <Button primary onClick={() => this.setState({ activeStep: ActiveStep.Backup })}>Select</Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="column column-1-2">
                                            <div className={stepStyle.stepContext}>
                                                <h3 className={stepStyle.stepSubHeader}>Custom</h3>
                                                <p>More control over your node.</p>
                                                <ul>
                                                    <li>Lets you choose syncing options</li>
                                                    <li>Lets you choose network options</li>
                                                    <li>Choose custom hostname</li>
                                                </ul>
                                                <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                                    <Button secondary onClick={() => this.setState({ activeStep: ActiveStep.ChooseName })}>Select</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="Choose a Name"
                                active={activeStep === ActiveStep.ChooseName}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <Input
                                        className={stepStyle.wizardLabel}
                                        pattern="^[a-z0-9]+[a-z0-9-.]{0,62}[a-z0-9]$"
                                        label="BitBox Base Hostname"
                                        placeholder="Valid hostname e.g. 'mybitboxbase'"
                                        type="text"
                                        title="Valid hostname is between 2-64 characters; lowercase a-z; digits 0-9; and periods or hypens, excluding first and last chars"
                                        onInput={this.handleNameInput} />
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                        <Button
                                            primary
                                            onClick={this.setHostname}
                                            disabled={!validHostname}>
                                            Continue
                                        </Button>
                                        <Button transparent onClick={() => this.setState({ activeStep: ActiveStep.ChooseSetup })}>Go Back</Button>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="Choose Syncing Option"
                                active={activeStep === ActiveStep.ChooseSyncingOption}
                                large>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 440px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>Pre-sync</h3>
                                                    <p>The quickest way to get started.</p>
                                                    <ul className={style.optionsList}>
                                                        <li>+ BitBoxBase is ready withing minutes</li>
                                                        <li>+ No initial download or verification necessary</li>
                                                        <li>- Trusting the provided data</li>
                                                        <li>- No independent validation of Bitcoin transaction and  balances</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => this.setState({ syncingOption: SyncingOptions.Presync, activeStep: ActiveStep.ChooseNetwork })}
                                                >
                                                    Select
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 440px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>Re-index</h3>
                                                    <p>Validate from genesis block</p>
                                                    <ul className={style.optionsList}>
                                                        <li>+ Full validation of the presynced data</li>
                                                        <li>- Takes ~1 day for the BitBoxBase to be ready</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => {                                   confirmation('This process takes approximately 1 day. Are you sure you want to continue?', result => {
                                                        if (result) {
                                                            this.setState({ syncingOption: SyncingOptions.Reindex, activeStep: ActiveStep.ChooseNetwork });
                                                        }
                                                    });
                                                }}>
                                                    Select
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="column column-1-3">
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 440px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>Re-sync</h3>
                                                    <p>Redownload the entire blockchain from scratch</p>
                                                    <ul className={style.optionsList}>
                                                        <li>+ Full validation of newly downloaded data</li>
                                                        <li>- Takes 2+ days and burdens the network (Bitcoin and especially Tor)</li>
                                                    </ul>
                                                </div>
                                                <Button primary onClick={() => {
                                                    confirmation('This process takes approximately 1 ~ 2 days depending on your internet connection. Are you sure you want to continue?', result => {
                                                        if (result) {
                                                            this.setState({ syncingOption: SyncingOptions.Resync, activeStep: ActiveStep.ChooseNetwork });
                                                        }
                                                    });
                                                }}>
                                                    Select
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="Choose Network Option"
                                active={activeStep === ActiveStep.ChooseNetwork}
                                large>
                                <div className="columnsContainer half">
                                    <div className="columns">
                                        <div className={['column', syncingOption === SyncingOptions.Resync ? 'column-1-3' : 'column-1-2'].join(' ')}>
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 460px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>Tor</h3>
                                                    {
                                                        syncingOption === SyncingOptions.Resync &&
                                                        <p>Tor only for all connections</p>
                                                    }
                                                    <ul className={style.optionsList}>
                                                        <li>+ Private</li>
                                                        <li>+ Difficult to track physical location</li>
                                                        <li>- Burdens the Tor network</li>
                                                        <li>- Totalitarian jurisdictions possibly suspicious </li>
                                                    </ul>
                                                </div>
                                                <div>
                                                {
                                                    syncingOption !== SyncingOptions.Resync &&
                                                    <p className={style.recommendation}>*Recommended option</p>
                                                }
                                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0px !important">
                                                        <Button primary onClick={() => this.setNetwork  (NetworkOptions.EnableTor, true)}>Select</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {
                                            syncingOption === SyncingOptions.Resync &&
                                            <div className="column column-1-3">
                                                <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 460px">
                                                    <div>
                                                        <h3 className={stepStyle.stepSubHeader}>Clearnet then Tor</h3>
                                                        <p>Public Internet for initial block download, then switches to Tor automatically</p>
                                                        <ul className={style.optionsList}>
                                                            <li>+ Faster IBD</li>
                                                            <li>+ Does not burden the Tor network during IBD</li>
                                                            <li>- Imperfect privacy</li>
                                                        </ul>
                                                    </div>
                                                    <Button primary onClick={() => this.setNetwork(NetworkOptions.ClearnetIBD, true)}>Select</Button>
                                                </div>
                                            </div>
                                        }
                                        <div className={['column', syncingOption === SyncingOptions.Resync ? 'column-1-3' : 'column-1-2'].join(' ')}>
                                            <div className={['flex flex-column flex-between', stepStyle.stepContext].join(' ')} style="min-height: 460px">
                                                <div>
                                                    <h3 className={stepStyle.stepSubHeader}>Clearnet</h3>
                                                    {
                                                        syncingOption === SyncingOptions.Resync &&
                                                        <p>Clearnet only for all connections</p>
                                                    }
                                                    <ul className={style.optionsList}>
                                                        <li>+ Fastest</li>
                                                        <li>+ Less latency</li>
                                                        <li>+ Allows VPN usage</li>
                                                        <li>- Leaks home IP address and geolocation if used without precautions</li>
                                                        <li>- ISP can detect Bitcoin node</li>
                                                    </ul>
                                                </div>
                                                <div>
                                                {
                                                    syncingOption === SyncingOptions.Resync &&
                                                    <p className={style.recommendation}>*Not recommended</p>
                                                }
                                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0px !important">
                                                        <Button primary onClick={() => this.setNetwork(NetworkOptions.EnableTor, false)}>Select</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="Wallet Backup"
                                active={activeStep === ActiveStep.Backup}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p>Insert USB memory stick into the BitBox Base to make a backup of your wallet.</p>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                        <Button primary onClick={() => this.createBackup()}>
                                            Create Backup
                                        </Button>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="Wallet Backup Created"
                                active={activeStep === ActiveStep.BackupCreated}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <p>You may now remove the memory stick and store it in a secure location.</p>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                        <Button primary onClick={() => this.setState({ activeStep: ActiveStep.Ready })}>Continue</Button>
                                    </div>
                                </div>
                            </Step>

                            <Step
                                title="You're Ready To Go!"
                                active={activeStep === ActiveStep.Ready}
                                width={540}>
                                <div className={stepStyle.stepContext}>
                                    <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                        <Button primary onClick={() => this.setState({ showWizard: false, activeStep: ActiveStep.PairingCode })}>Go to Dashboard</Button>
                                    </div>
                                </div>
                            </Step>

                        </Steps>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate<BitBoxBaseProps>()(BitBoxBase);
export { HOC as BitBoxBase };
