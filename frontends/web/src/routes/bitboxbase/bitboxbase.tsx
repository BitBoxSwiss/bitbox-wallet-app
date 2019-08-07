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
import { alertOctagon } from '../../assets/icons/alert-octagon.svg';
import { alertUser } from '../../components/alert/Alert';
import { Button } from '../../components/forms';
import { Header } from '../../components/layout/header';
import { Step, Steps } from '../../components/steps';
import * as style from '../../components/steps/steps.css';
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

interface State {
    middlewareInfo?: MiddlewareInfoType;
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
}

type Props = BitBoxBaseProps & TranslateProps;

class BitBoxBase extends Component<Props, State> {

    constructor(props) {
        super(props);
        this.state = {
            hash: undefined,
            middlewareInfo: undefined,
            bitboxBaseID: '',
            status: '',
            bitboxBaseVerified: false,
            showWizard: false,
        };
    }

    private unsubscribe!: () => void;
    private unsubscribeDemo!: () => void;

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
                case 'middlewareInfoChanged':
                    this.onNewMiddlewareInfo();
                    break;
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
            this.unsubscribeDemo = apiSubscribe('/bitboxbases/' + this.props.bitboxBaseID + '/middlewareinfo', ({ object }) => {
                this.setState({ middlewareInfo: object });
            });
        }
    }

    public componentWillUnmount() {
        this.unsubscribe();
        this.unsubscribeDemo();
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
        apiGet(this.apiPrefix() + '/status').then(status => {
            if (!this.state.showWizard && ['connected', 'unpaired', 'pairingFailed', 'bitcoinPre'].includes(status)) {
                this.setState({ showWizard: true });
            }
            this.setState({
                status,
            });
            if (this.state.status === 'initialized') {
                this.onNewMiddlewareInfo();
            }
        });
    }

    private onNewMiddlewareInfo = () => {
        apiGet(this.apiPrefix() + '/middlewareinfo').then(middlewareInfo => {
            this.setState({ middlewareInfo });
        });
    }

    private handleGetStarted = () => {
        this.setState({ showWizard: false });
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

    private onDisconnect = () => {
        route('/bitboxbase', true);
    }

    private syncOption = (syncOption: 'pre-synced' | 'reindex' | 'scratch') => {
        apiPost(this.apiPrefix() + '/syncoption', {
            option: syncOption,
        }).then(success => {
            if (!success) {
                alertUser('Failed to execute sync from pre-synced state');
            }
        });
    }

    public render(
        {
            t,
            bitboxBaseID,
        }: RenderableProps<Props>,
        {
            middlewareInfo,
            showWizard,
            status,
            bitboxBaseVerified,
            hash,
        }: State,
    ) {
        if (!showWizard) {
            if (!middlewareInfo) {
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
                    <div class="row">
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

                    <div className="flex flex-column flex-start flex-items-center flex-1 scrollableContainer" style="background-color: #F9F9F9;">
                        <Steps>
                            <Step
                                active={status === 'unpaired' || status === 'pairingFailed'}
                                title={t('bitboxBaseWizard.pairing.title')}>
                                {
                                    status === 'pairingFailed' && (
                                    <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                        <div className={style.standOut}>
                                            <img src={alertOctagon} />
                                            <span className={style.error}>{t('bitboxBaseWizard.pairing.failed')}</span>
                                        </div>
                                       <div class="buttons flex flex-row flex-end">
                                           <Button onClick={this.removeBitBoxBase} danger>Disconnect Base</Button>
                                       </div>
                                    </div>
                                    )
                                }
                                <div className={[style.stepContext, status === 'pairingFailed' ? style.disabled : ''].join(' ')}>
                                    <p>{t('bitboxBaseWizard.pairing.unpaired')}</p>
                                    <pre>{hash}</pre>
                                    {
                                        bitboxBaseVerified && (
                                            <p>{t('bitboxBaseWizard.pairing.paired')}</p>
                                        )
                                    }
                                </div>
                            </Step>
                            <Step
                                active={status === 'bitcoinPre'}
                                title={t('bitboxBaseWizard.bitcoin.title')}>
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                   <div class="buttons flex flex-row flex-end">
                                       <Button onClick={() => this.syncOption('pre-synced')} danger>{t('bitboxBaseWizard.bitcoin.pre')}</Button>
                                   </div>
                                   <div className={style.stepContext}>
                                     <p>{t('bitboxBaseWizard.bitcoin.preInfo')}</p>
                                   </div>
                                </div>
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                   <div class="buttons flex flex-row flex-end">
                                       <Button onClick={() => this.syncOption('reindex')} danger>{t('bitboxBaseWizard.bitcoin.reindex')}</Button>
                                   </div>
                                   <div className={style.stepContext}>
                                       <p>{t('bitboxBaseWizard.bitcoin.reindexInfo')}</p>
                                   </div>
                                </div>
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                   <div class="buttons flex flex-row flex-end">
                                       <Button onClick={() => this.syncOption('scratch')} danger>{t('bitboxBaseWizard.bitcoin.syncFromScratch')}</Button>
                                   </div>
                                   <div className={style.stepContext}>
                                      <p>{t('bitboxBaseWizard.bitcoin.syncFromScratchInfo')}</p>
                                   </div>
                                </div>
                            </Step>
                            <Step
                                active={status === 'initialized'}
                                title={t('bitboxBaseWizard.success.title')}>
                                <div className={style.stepContext}>
                                    <p>{t('bitboxBaseWizard.success.text')}</p>
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

const HOC = translate<BitBoxBaseProps>()(BitBoxBase);
export { HOC as BitBoxBase };
