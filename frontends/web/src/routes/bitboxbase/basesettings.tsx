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
import { alertUser } from '../../components/alert/Alert';
import { confirmation } from '../../components/confirm/Confirm';
import { Header } from '../../components/layout/header';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';
import { BitBoxBaseInfo, BitBoxBaseServiceInfo } from './bitboxbase';
import * as style from './bitboxbase.css';

interface SettingsProps {
    baseID: string | null;
    baseInfo: BitBoxBaseInfo;
    serviceInfo: BitBoxBaseServiceInfo;
    disconnect: () => void;
    connectElectrum: () => void;
    apiPrefix: string;
}

interface State {
    expandedDashboard: boolean;
}

type Props = SettingsProps & TranslateProps;

class BaseSettings extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            expandedDashboard: false,
        };
    }

    private restart = () => {
        apiPost(this.props.apiPrefix + '/reboot-base')
                .then(response => {
                    if (!response.success) {
                        alertUser(response.message);
                    }
                });
            }

    public render(
        {
            t,
            serviceInfo,
            baseInfo,
            disconnect,
            connectElectrum,
        }: RenderableProps<Props>,
        {
            expandedDashboard,
        }: State,
    ) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('bitboxBase.settings.title')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className={style.dashboardContainer}>
                            <div className={[style.dashboard, expandedDashboard ? style.expanded : ''].join(' ')}>
                                <div className={style.nameStatus}>
                                        <div className="subHeader">
                                            <h3>{baseInfo.hostname}</h3>
                                        </div>
                                        <div>
                                        <span className="m-left-quarter text-black"><span className={[style.statusBadge, style.large, style.online].join(' ')}>
                                            {/* </span>{baseInfo.status}</span> */}
                                            </span>Online</span>
                                        </div>
                                </div>
                                <div className={style.items}>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>{Math.round(100 * serviceInfo.bitcoindVerificationProgress)}%</p>
                                            <p>Sync status</p>
                                        </div>
                                    </div>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>{serviceInfo.bitcoindPeers}</p>
                                            <p>Connected peers</p>
                                        </div>
                                    </div>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>TODO</p>
                                            <p>Lightning channels</p>
                                        </div>
                                    </div>
                                </div>
                                <div className={style.expandedItemsContainer}>
                                    <div className="columnsContainer">
                                        <div className="columns">
                                            <div className="column column-1-3">
                                                <div className="subHeaderContainer">
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.networking')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <div className={style.expandedItem}>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.ipAddress')}</span>
                                                            <p>{baseInfo.middlewareLocalIP}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.port')}</span>
                                                            <p>{baseInfo.middlewareLocalPort}</p>
                                                        </div>
                                                    </div>
                                                    <div className={style.expandedItem}>
                                                        <div>
                                                            <span className="label">Tor Onion address</span>
                                                            <p>{baseInfo.middlewareTorOnion}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">Tor port</span>
                                                            <p>{baseInfo.middlewareTorPort}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="column column-1-3">
                                                <div className="subHeaderContainer">
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.bitcoin')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <div className={[style.expandedItem, style.equal].join(' ')}>
                                                        <div>
                                                            <span className="label">Status</span>
                                                            <p><span className={[style.statusBadge, style.online].join(' ')}></span>{baseInfo.isBitcoindListening ? 'Listening' : 'Offline'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">Version</span>
                                                            <p>{baseInfo.bitcoindVersion}</p>
                                                        </div>
                                                    </div>
                                                    <div className={[style.expandedItem, style.equal].join(' ')}>
                                                        <div>
                                                            <span className="label">Blocks</span>
                                                            <p>{serviceInfo.bitcoindBlocks.toString()}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">Headers</span>
                                                            <p>{serviceInfo.bitcoindHeaders.toString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="column column-1-3">
                                                <div className="subHeaderContainer">
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.lightning')} and {t('bitboxBase.settings.advanced.subheaders.electrs')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <div className={[style.expandedItem, style.equal].join(' ')}>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.subheaders.lightning')} Version</span>
                                                            <p>{baseInfo.lightningdVersion}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.subheaders.lightning')} Blocks</span>
                                                            <p>{serviceInfo.lightningdBlocks.toString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className={[style.expandedItem, style.equal].join(' ')}>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.subheaders.electrs')} Version</span>
                                                            <p>{baseInfo.electrsVersion}</p>
                                                        </div>
                                                        <div>
                                                            <span className="label">{t('bitboxBase.settings.advanced.subheaders.electrs')} Blocks</span>
                                                            <p>{serviceInfo.electrsBlocks.toString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <hr style="margin: 0px;"/>
                            <button className={style.expandButton} onClick={() => this.setState({ expandedDashboard: !expandedDashboard })}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round">
                                    {
                                        expandedDashboard ? (
                                            <polyline points="18 15 12 9 6 15"></polyline>
                                        ) : (
                                            <polyline points="6 11 12 17 18 11"></polyline>
                                        )
                                    }
                                </svg>
                            </button>
                        </div>
                        <div className="content padded">
                            <div className="columnsContainer m-top-half">
                                <div className="columns">
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.node.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton>{t('bitboxBase.settings.node.changeName')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.node.password')}</SettingsButton>
                                            <SettingsButton optionalText="Enabled">{t('bitboxBase.settings.node.tor')}</SettingsButton>
                                            <SettingsButton danger onClick={disconnect}>{t('bitboxBase.settings.node.disconnect')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.system.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton>{t('bitboxBase.settings.system.update')}</SettingsButton>
                                            <SettingsButton onClick={() => {
                                                confirmation(t('bitboxBase.settings.system.confirmRestart'), confirmed => {
                                                    if (confirmed) {
                                                        this.restart();
                                                    }
                                                });
                                            }}>{t('bitboxBase.settings.system.restart')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.system.shutdown')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.backups.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton>{t('bitboxBase.settings.backups.create')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.backups.restore')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.advanced.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton optionalText="Disabled">{t('bitboxBase.settings.advanced.sshAccess')}</SettingsButton>
                                            <SettingsButton onClick={connectElectrum}>{t('bitboxBase.settings.advanced.connectElectrum')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.advanced.syncOptions')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.advanced.manual')}</SettingsButton>
                                            <SettingsButton danger>{t('bitboxBase.settings.advanced.reset')}</SettingsButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const TranslatedBaseSettings = translate<SettingsProps>()(BaseSettings);
export { TranslatedBaseSettings as BaseSettings };
