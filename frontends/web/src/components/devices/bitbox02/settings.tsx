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
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import RandomNumber from '../../../routes/device/settings/components/randomnumber';
import { apiGet } from '../../../utils/request';
import { Header } from '../../layout/header';
import { SettingsButton } from '../../settingsButton/settingsButton';
import { SettingsItem } from '../../settingsButton/settingsItem';
import { MnemonicPassphraseButton } from './mnemonicpassphrase';
import { Reset } from './reset';
import { SetDeviceName } from './setdevicename';
import { ShowMnemonic } from './showmnemonic';
import { UpgradeButton, VersionInfo } from './upgradebutton';

interface SettingsProps {
    deviceID: string;
}

interface State {
    versionInfo?: VersionInfo;
    deviceInfo: {
        name: string;
        initialized: boolean;
        version: string;
        mnemonicPassphraseEnabled: boolean;
    };
}

interface LoadedSettingsProps {
    sdCardInserted: boolean;
}

type Props = LoadedSettingsProps & SettingsProps & TranslateProps;

class Settings extends Component<Props, State> {
    private apiPrefix = () => {
        return 'devices/bitbox02/' + this.props.deviceID;
    }

    private getInfo = () => {
        apiGet(this.apiPrefix() + '/info').then(deviceInfo => {
            this.setState({ deviceInfo });
        });
    }

    public componentDidMount() {
        this.getInfo();
        apiGet(this.apiPrefix() + '/bundled-firmware-version').then(versionInfo => {
            this.setState({ versionInfo });
        });
    }

    public render(
        {
            deviceID,
            sdCardInserted,
            t,
        }: RenderableProps<Props>,
        {
            versionInfo,
            deviceInfo,
        }: State,
    ) {
        if (deviceInfo === undefined) {
            return null;
        }
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('sidebar.device')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div className="columnsContainer">
                                <div className="columns">
                                    <div className="column column-1-2">
                                        <div class="subHeaderContainer first">
                                            <div class="subHeader">
                                                <h3>{t('deviceSettings.secrets.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SettingsButton link href={`/manage-backups/${deviceID}/${sdCardInserted}`}>
                                                {t('deviceSettings.secrets.manageBackups')}
                                            </SettingsButton>
                                            <ShowMnemonic apiPrefix={this.apiPrefix()} />
                                            <Reset apiPrefix={this.apiPrefix()} />
                                        </div>
                                    </div>
                                    <div className="column column-1-2">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('deviceSettings.hardware.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <SetDeviceName
                                                apiPrefix={this.apiPrefix()}
                                                getInfo={this.getInfo}
                                                name={(deviceInfo && deviceInfo.name) ? deviceInfo.name : undefined} />
                                            <RandomNumber apiPrefix={this.apiPrefix()} />
                                        </div>
                                    </div>
                                </div>
                                <div className="columns">
                                    <div className="column column-1-2">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('deviceSettings.firmware.title')}</h3>
                                            </div>
                                        </div>
                                        <div class="box slim divide">
                                            {
                                                versionInfo && versionInfo.canUpgrade ? (
                                                    <UpgradeButton
                                                        apiPrefix={this.apiPrefix()}
                                                        versionInfo={versionInfo}/>
                                                ) : versionInfo && (
                                                    <SettingsItem optionalText={versionInfo.newVersion}>
                                                        {t('deviceSettings.firmware.upToDate')}
                                                    </SettingsItem>
                                                )
                                            }
                                        </div>
                                    </div>
                                    <div className="column column-1-2">
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.expert.title')}</h3>
                                            </div>
                                        </div>
                                        <div className="box slim divide">
                                            <MnemonicPassphraseButton
                                                apiPrefix={this.apiPrefix()}
                                                mnemonicPassphraseEnabled={deviceInfo.mnemonicPassphraseEnabled}
                                                getInfo={this.getInfo} />
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

const loadHOC = load<LoadedSettingsProps, SettingsProps & TranslateProps>(({ deviceID }) => ({ sdCardInserted: 'devices/bitbox02/' + deviceID + '/check-sdcard' }))(Settings);
const HOC = translate<SettingsProps>()(loadHOC);
export { HOC as Settings };
