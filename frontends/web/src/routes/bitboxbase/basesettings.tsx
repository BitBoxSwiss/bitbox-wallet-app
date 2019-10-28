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
import { Header } from '../../components/layout/header';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../components/settingsButton/settingsItem';
import { translate, TranslateProps } from '../../decorators/translate';
import { MiddlewareInfoType, VerificationProgressType } from './bitboxbase';
import * as style from './bitboxbase.css';

interface SettingsProps {
    baseID: string | null;
    middlewareInfo: MiddlewareInfoType;
    verificationProgress: VerificationProgressType;
    disconnect: () => void;
    connectElectrum: () => void;
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

    public render(
        {
            t,
            // middlewareInfo,
            // verificationProgress,
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
                                    <p>My BitBoxBase:</p>
                                    <p><span className={[style.statusBadge, style.online].join(' ')}></span>Online</p>
                                </div>
                                <div className={style.items}>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>85%</p>
                                            <p>Sync status</p>
                                        </div>
                                    </div>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>14</p>
                                            <p>Connected peers</p>
                                        </div>
                                    </div>
                                    <div className={style.item}>
                                        <div className={style.dashboardItem}>
                                            <p>8</p>
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
                                                    <SettingsItem optionalText="192.168.1.1">{t('bitboxBase.settings.advanced.ipAddress')}</SettingsItem>
                                                    <SettingsItem optionalText="8845">{t('bitboxBase.settings.advanced.port')}</SettingsItem>
                                                    <SettingsItem optionalText="192.168.1.1">Tor Onion address</SettingsItem>
                                                    <SettingsItem optionalText="8845">Tor port</SettingsItem>
                                                </div>
                                            </div>
                                            <div className="column column-1-3">
                                                <div className="subHeaderContainer">
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.bitcoin')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <SettingsItem optionalText="0.5.1">Version</SettingsItem>
                                                    <SettingsItem optionalText="Listening">Status</SettingsItem>
                                                    <SettingsItem optionalText="550,000">Blocks</SettingsItem>
                                                    <SettingsItem optionalText="0">Headers</SettingsItem>
                                                </div>
                                            </div>
                                            <div className="column column-1-3">
                                                <div className="subHeaderContainer">
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.lightning')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <SettingsItem optionalText="0.5.1">Version</SettingsItem>
                                                    <SettingsItem optionalText="22,500">Blocks</SettingsItem>
                                                </div>
                                                <div className={['subHeaderContainer', style.lastSubheader].join(' ')}>
                                                    <div className="subHeader">
                                                        <h3>{t('bitboxBase.settings.advanced.subheaders.electrs')}</h3>
                                                    </div>
                                                </div>
                                                <div className="box slim divide">
                                                    <SettingsItem optionalText="1.2">Version</SettingsItem>
                                                    <SettingsItem optionalText="999,999">Blocks</SettingsItem>
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
                                            <polyline points="6 9 12 15 18 9"></polyline>
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
                                            <SettingsButton>{t('bitboxBase.settings.system.restart')}</SettingsButton>
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
