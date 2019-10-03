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

export interface BitBoxBaseProps {
    bitboxBaseID: string | null;
}

interface MiddlewareInfoType {
    blocks: number;
    difficulty: number;
    lightningAlias: string;
}

interface VerificationProgressType {
    blocks: number;
    headers: number;
    verificationProgress: number;
}

enum ActiveStep {
    PairingCode,
    SetPassword,
    ChooseSetup,
    ChooseName,
    ChooseSyncingOption,
    ChooseNetwork,
    ChooseIBDNetwork,
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
    'bitcoinPre' |
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
            if (!this.state.showWizard && ['connected', 'unpaired', 'pairingFailed', 'bitcoinPre'].includes(status)) {
                this.setState({ showWizard: true });
            }
            this.setState({
                status,
            });
            // Dummy check for automatic paired response from base until we have an rpc response and event from the base
            if (this.state.status === 'bitcoinPre') {
                this.setState({activeStep: ActiveStep.SetPassword});
            }
            if (this.state.status === 'initialized') {
                this.onNewMiddlewareInfo();
                this.onNewVerificationProgress();
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

    private submitChangePassword = (event: Event) => {
        event.preventDefault();
        apiPost(this.apiPrefix() + '/user-changepassword', {username: 'admin', newPassword: this.state.password})
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
                    this.setState({ activeStep: ActiveStep.Backup });
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
        }: State,
    ) {
        if (!showWizard) {
            if (!middlewareInfo) {
                return null;
            }
            if (!verificationProgress) {
                return null;
            }
            return (
                <div class="row">
                    <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                        <ul>
                            <li>Block Number: {middlewareInfo.blocks}</li>
                            <li>Difficulty: {middlewareInfo.difficulty}</li>
                            <li>BitBox Base ID: {bitboxBaseID}</li>
                            <li>Lightning Alias: {middlewareInfo.lightningAlias}</li>
                        </ul>
                    </div>
                    <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                        <ul>
                            <li>Blocks: {verificationProgress.blocks}</li>
                            <li>Headers: {verificationProgress.headers}</li>
                            <li>VerificationProgress: {verificationProgress.verificationProgress}</li>
                        </ul>
                    </div>
                    <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                        <div class="buttons flex flex-row flex-end">
                            <Button onClick={this.removeBitBoxBase} danger>Disconnect Base</Button>
                        </div>
                        <div class="buttons flex flex-row flex-end">
                            <Button onClick={this.connectElectrum}>Connect Electrum</Button>
                        </div>
                    </div>
                </div>
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

                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <Steps>

                                <Step title="Verify Pairing Code" active={activeStep === ActiveStep.PairingCode} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <p>{t('bitboxBaseWizard.pairing.unpaired')}</p>
                                        <pre>{hash}</pre>
                                    </div>
                                </Step>

                                <Step title="Set a Password" active={activeStep === ActiveStep.SetPassword} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <form onSubmit={this.submitChangePassword}>
                                            <PasswordRepeatInput
                                                label={t('initialize.input.label')}
                                                repeatLabel={t('initialize.input.labelRepeat')}
                                                onValidPassword={this.setPassword} />
                                            <div className={['buttons text-center', stepStyle.fullWidth].join(' ')}>
                                                <Button
                                                    disabled={!password}
                                                    primary
                                                    type="submit"
                                                >
                                                    {t('initialize.create')}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </Step>

                                <Step title="Choose Setup" active={activeStep === ActiveStep.ChooseSetup} large>
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

                                <Step title="Choose a Name" active={activeStep === ActiveStep.ChooseName} width={540}>
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

                                <Step title="Choose Syncing Option" active={activeStep === ActiveStep.ChooseSyncingOption} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                            <Button primary onClick={() => this.setState({ syncingOption: SyncingOptions.Presync, activeStep: ActiveStep.ChooseNetwork })}>
                                                Start from pre-synced blockchain
                                            </Button>
                                            <Button primary onClick={() => {
                                                confirmation('This process takes approximately 1 day. Are you sure you want to continue?', result => {
                                                    if (result) {
                                                        this.setState({ syncingOption: SyncingOptions.Reindex, activeStep: ActiveStep.ChooseNetwork });
                                                    }
                                                });
                                            }}>
                                                Validate from genesis block
                                            </Button>
                                            <Button primary onClick={() => {
                                                confirmation('This process takes approximately 1 ~ 2 days depending on your internet connection. Are you sure you want to continue?', result => {
                                                    if (result) {
                                                        this.setState({ syncingOption: SyncingOptions.Resync, activeStep: ActiveStep.ChooseIBDNetwork });
                                                    }
                                                });
                                            }}>
                                                Sync from scratch
                                            </Button>
                                        </div>
                                    </div>
                                </Step>

                                <Step title="Choose Network Option" active={activeStep === ActiveStep.ChooseNetwork} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                            <Button primary onClick={() => this.setNetwork(NetworkOptions.EnableTor, true)}>Tor Only</Button>
                                            <Button primary onClick={() => this.setNetwork(NetworkOptions.EnableTor, false)}>Clearnet Only</Button>
                                        </div>
                                    </div>
                                </Step>

                                <Step title="Choose Network Option" active={activeStep === ActiveStep.ChooseIBDNetwork} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                            <Button primary onClick={() => this.setNetwork(NetworkOptions.EnableTor, true)}>Tor Only</Button>
                                            <Button primary onClick={() => this.setNetwork(NetworkOptions.EnableTor, false)}>Clearnet Only</Button>
                                            <Button primary onClick={() => this.setNetwork(NetworkOptions.ClearnetIBD, true)}>Clearnet Only for Initial Block Download</Button>
                                        </div>
                                    </div>
                                </Step>

                                {/* TODO: Add API calls for backup options  */}

                                <Step title="Wallet Backup" active={activeStep === ActiveStep.Backup} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <p>Insert USB memory stick into the BitBox Base to make a backup of your wallet.</p>
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                            <Button primary onClick={() => this.createBackup()}>
                                                Create Backup
                                            </Button>
                                        </div>
                                    </div>
                                </Step>

                                <Step title="Wallet Backup Created" active={activeStep === ActiveStep.BackupCreated} width={540}>
                                    <div className={stepStyle.stepContext}>
                                        <p>You may now remove the memory stick and store it in a secure location.</p>
                                        <div className={['buttons text-center', stepStyle.fullWidth].join(' ')} style="margin-top: 0 !important;">
                                            <Button primary onClick={() => this.setState({ activeStep: ActiveStep.Ready })}>Continue</Button>
                                        </div>
                                    </div>
                                </Step>

                                <Step title="You're Ready To Go!" active={activeStep === ActiveStep.Ready} width={540}>
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
            </div>
        );
    }
}

const HOC = translate<BitBoxBaseProps>()(BitBoxBase);
export { HOC as BitBoxBase };
