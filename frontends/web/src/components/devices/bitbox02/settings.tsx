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
import * as style from '../../../components/steps/steps.css';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import RandomNumber from '../../../routes/device/settings/components/randomnumber';
import { apiGet } from '../../../utils/request';
import { ButtonLink } from '../../forms';
import { Header } from '../../layout/header';
import DeviceInfo from './deviceinfo';
import SetDeviceName from './setdevicename';
import { UpgradeButton, VersionInfo } from './upgradebutton';

interface SettingsProps {
    deviceID: string;
}

interface State {
    versionInfo?: VersionInfo;
}

interface LoadedSettingsProps {
    sdCardInserted: boolean;
}

type Props = LoadedSettingsProps & SettingsProps & TranslateProps;

class Settings extends Component<Props, State> {
    private apiPrefix = () => {
        return 'devices/bitbox02/' + this.props.deviceID;
    }

    public componentDidMount() {
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
        }: State,
    ) {
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('sidebar.device')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div className={style.buttons}>
                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.secrets.title')}</h3>
                                    </div>
                                </div>
                                <div className="items">
                                    <ButtonLink primary href={`/manage-backups/${deviceID}/${sdCardInserted}`}>
                                        {t('deviceSettings.secrets.manageBackups')}
                                    </ButtonLink>
                                    <DeviceInfo apiPrefix={this.apiPrefix()} />
                                </div>
                                <hr />
                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.firmware.title')}</h3>
                                    </div>
                                </div>
                                <dl class="items marginBottom">
                                    <div>
                                        <dt>{t('deviceSettings.firmware.version.label')}</dt>
                                        <dd>{versionInfo ? versionInfo.currentVersion : t('loading')}</dd>
                                    </div>
                                    {
                                        versionInfo && versionInfo.canUpgrade && (
                                            <div>
                                                <dt>{t('deviceSettings.firmware.newVersion.label')}</dt>
                                                <dd>{versionInfo.newVersion}</dd>
                                            </div>
                                        ) || (
                                            <div>
                                                <dt></dt>
                                                <dd>{t('deviceSettings.firmware.upToDate')}</dd>
                                            </div>
                                        )
                                    }
                                </dl>
                                {
                                    versionInfo && versionInfo.canUpgrade && (
                                        <div class="buttons flex flex-row flex-start flex-baseline flex-wrap">
                                            <UpgradeButton
                                                apiPrefix={this.apiPrefix()}
                                                versionInfo={versionInfo}
                                            />
                                        </div>
                                    )
                                }
                                <hr />
                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.hardware.title')}</h3>
                                    </div>
                                </div>
                                <div className="items">
                                    <SetDeviceName apiPrefix={this.apiPrefix()} />
                                    <RandomNumber apiPrefix={this.apiPrefix()} />
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
