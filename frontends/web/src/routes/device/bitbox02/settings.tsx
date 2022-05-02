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

import { FunctionComponent, useEffect, useState } from 'react';
import { route } from '../../../utils/route';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../hooks/api';
import { getDeviceInfo, DeviceInfo, getVersion, getRootFingerprint } from '../../../api/bitbox02';
import { Entry } from '../../../components/guide/entry';
import { Guide } from '../../../components/guide/guide';
import { SwissMadeOpenSource } from '../../../components/icon/logo';
import { Footer } from '../../../components/layout';
import { Header } from '../../../components/layout/header';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../../components/settingsButton/settingsItem';
import { GotoStartupSettings } from './gotostartupsettings';
import { Reset } from './reset';
import { SetDeviceName } from './setdevicename';
import { ShowMnemonic } from './showmnemonic';
import { UpgradeButton } from './upgradebutton';
import { alertUser } from '../../../components/alert/Alert';

type Props = {
    deviceID: string;
}

export const Settings: FunctionComponent<Props> = ({ deviceID }) => {
    const { t } = useTranslation();
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>();
    const getInfo = () => {
        getDeviceInfo(deviceID).then(setDeviceInfo).catch(error => {
            console.error(error);
            alertUser(t('genericError'));
        });
    };
    useEffect(getInfo, [deviceID, t]);

    const rootFingerprint = useLoad(async () => {
        try {
            return await getRootFingerprint(deviceID);
        } catch (error) {
            console.error(error);
        }
    }, [deviceID]);

    const versionInfo = useLoad(() => getVersion(deviceID), [deviceID]);
    const apiPrefix = 'devices/bitbox02/' + deviceID;

    const routeToPassphrase = () => {
        route(`/passphrase/${deviceID}`);
    };

    if (deviceInfo === undefined) {
        return null;
    }
    return (
        <div className="contentWithGuide">
            <div className="container">
                <Header title={<h2>{t('sidebar.device')}</h2>} />
                <div className="innerContainer scrollableContainer">
                    <div className="content padded">
                        <div className="columnsContainer">
                            <div className="columns">
                                <div className="column column-1-2">
                                    <h3 className="subTitle">{t('deviceSettings.secrets.title')}</h3>
                                    <div className="box slim divide">
                                        <SettingsButton onClick={() => route(`/manage-backups/${deviceID}`)}>
                                            {t('deviceSettings.secrets.manageBackups')}
                                        </SettingsButton>
                                        <ShowMnemonic apiPrefix={apiPrefix} />
                                        { rootFingerprint !== undefined && (
                                              <SettingsItem optionalText={rootFingerprint}>
                                                  {t('deviceSettings.hardware.rootFingerprint')}
                                              </SettingsItem>
                                        ) }
                                        <Reset apiPrefix={apiPrefix} />
                                    </div>
                                </div>
                                <div className="column column-1-2">
                                    <h3 className="subTitle">{t('deviceSettings.hardware.title')}</h3>
                                    <div className="box slim divide">
                                        <SetDeviceName
                                            apiPrefix={apiPrefix}
                                            getInfo={getInfo}
                                            name={(deviceInfo && deviceInfo.name) ? deviceInfo.name : undefined} />
                                        { deviceInfo && deviceInfo.securechipModel !== '' && (
                                              <SettingsItem optionalText={deviceInfo.securechipModel}>
                                                  {t('deviceSettings.hardware.securechip')}
                                              </SettingsItem>
                                        ) }
                                    </div>
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column column-1-2">
                                    <h3 className="subTitle">{t('deviceSettings.firmware.title')}</h3>
                                    <div className="box slim divide">
                                        {
                                            versionInfo && versionInfo.canUpgrade ? (
                                                <UpgradeButton
                                                    apiPrefix={apiPrefix}
                                                    versionInfo={versionInfo}/>
                                            ) : versionInfo && (
                                                <SettingsItem optionalText={versionInfo.currentVersion}>
                                                    {t('deviceSettings.firmware.upToDate')}
                                                </SettingsItem>
                                            )
                                        }
                                    </div>
                                </div>
                                <div className="column column-1-2">
                                    <h3 className="subTitle">{t('settings.expert.title')}</h3>
                                    <div className="box slim divide">
                                        <SettingsButton onClick={routeToPassphrase}>
                                            { deviceInfo.mnemonicPassphraseEnabled
                                              ? t('passphrase.disable')
                                              : t('passphrase.enable')}
                                        </SettingsButton>
                                        { versionInfo && versionInfo.canGotoStartupSettings ? (
                                              <GotoStartupSettings apiPrefix={apiPrefix} />
                                        ) : null
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Footer>
                        <SwissMadeOpenSource />
                    </Footer>
                </div>
            </div>
            <Guide>
                <Entry key="accountDescription" entry={t('guide.bitbox02.rootFingerprint')} />
            </Guide>
        </div>
    );
}
