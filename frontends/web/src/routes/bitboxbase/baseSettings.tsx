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

type Props = SettingsProps & TranslateProps;

class BaseSettings extends Component<Props> {
    constructor(props) {
        super(props);
    }

    public render(
        {
            t,
            baseID,
            // middlewareInfo,
            // verificationProgress,
            disconnect,
            connectElectrum,
        }: RenderableProps<Props>,
    ) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('bitboxBase.settings.title')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <div className={style.dashboard}>

                            </div>
                            <div className="columnsContainer m-top-default-extra">
                                <div className="columns">
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.basics.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton optionalText="My BitBoxBase">{t('bitboxBase.settings.basics.name')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.basics.password')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.basics.info')}</SettingsButton>
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
                                            <SettingsButton>{t('bitboxBase.settings.backups.manage')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.node.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton>{t('bitboxBase.settings.node.update')}</SettingsButton>
                                            <SettingsButton onClick={disconnect}>{t('bitboxBase.settings.node.disconnect')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.node.restart')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.node.shutdown')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.networking.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsItem optionalText={baseID}>{t('bitboxBase.settings.networking.ipAddress')}</SettingsItem>
                                            <SettingsButton optionalText="Enabled">{t('bitboxBase.settings.networking.tor')}</SettingsButton>
                                            <SettingsButton optionalText="Allowed">{t('bitboxBase.settings.networking.incomingConnections')}</SettingsButton>
                                        </div>
                                    </div>
                                    <div className="column column-1-3">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('bitboxBase.settings.advanced.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton optionalText="Enabled">{t('bitboxBase.settings.advanced.rootAccess')}</SettingsButton>
                                            <SettingsButton optionalText="Disabled">{t('bitboxBase.settings.advanced.sshAccess')}</SettingsButton>
                                            <SettingsButton onClick={connectElectrum}>{t('bitboxBase.settings.advanced.connectElectrum')}</SettingsButton>
                                            <SettingsButton>{t('bitboxBase.settings.advanced.syncOptions')}</SettingsButton>
                                            <SettingsButton danger>{t('bitboxBase.settings.advanced.reset')}</SettingsButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* <div class="row">
                                <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                                    <ul>
                                        <li>Block Number: {middlewareInfo.blocks}</li>
                                        <li>Difficulty: {middlewareInfo.difficulty}</li>
                                        <li>BitBox Base ID: {baseID}</li>
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
                            </div> */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const TranslatedBaseSettings = translate<SettingsProps>()(BaseSettings);
export { TranslatedBaseSettings as BaseSettings };
