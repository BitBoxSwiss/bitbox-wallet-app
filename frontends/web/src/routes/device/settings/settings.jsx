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

import { Component } from 'preact';
import { ButtonLink } from '../../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { Guide } from '../../../components/guide/guide';
import Spinner from '../../../components/spinner/Spinner';
import Blink from './components/blink';
import RandomNumber from './components/randomnumber';
import HiddenWallet from './components/hiddenwallet';
import ChangePIN from './components/changepin';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from './components/upgradefirmware';
import Header from '../../../components/header/Header';
import ButtonGroup from '../../../components/buttonGroup/ButtonGroup';

@translate()
export default class Settings extends Component {
    state = {
        firmwareVersion: null,
        newVersion: null,
        lock: true,
        name: null,
        spinner: true,
        sdcard: false,
        paired: false,
        connected: false,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard, lock, name }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
                lock, name, sdcard,
                spinner: false,
            });
        });

        apiGet('devices/' + this.props.deviceID + '/paired').then((paired) => {
            this.setState({ paired });
        });

        apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
            this.setState({ newVersion: version.replace('v', '') });
        });

        this.unsubscribe = apiWebsocket(({ type, data }) => {
            if (type === 'device') {
                switch (data) {
                case 'mobileDisconnected':
                    this.setState({ connected: false });
                    break;
                case 'mobileConnected':
                    this.setState({ connected: true });
                    break;
                case 'pairingSuccess':
                    this.setState({ paired: true });
                    break;
                case 'pairingFalse':
                    this.setState({ paired: false });
                    break;
                }
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    render({
        t,
        deviceID,
        sidebar,
        guide,
    }, {
        firmwareVersion,
        newVersion,
        lock,
        name,
        spinner,
        sdcard,
        paired,
        connected,
    }) {
        const canUpgrade = firmwareVersion && newVersion !== firmwareVersion;
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header sidebar={sidebar} guide={guide}>
                        <h2>{name === null ? '' : name || 'BitBox'}</h2>
                        <ButtonGroup guide={guide} />
                    </Header>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="flex-1">

                                <div class="subHeaderContainer first">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.secrets.title')}</h3>
                                    </div>
                                </div>
                                <div class="buttons wrapped flex flex-row flex-start flex-items-baseline flex-wrap">
                                    <ButtonLink primary href={`/manage-backups/${deviceID}`} disabled={lock}>
                                        {t('deviceSettings.secrets.manageBackups')}
                                    </ButtonLink>
                                    <ChangePIN deviceID={deviceID} />
                                    <HiddenWallet deviceID={deviceID} disabled={lock} />
                                    <Reset deviceID={deviceID} />
                                </div>

                                <hr />

                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.pairing.title')}</h3>
                                    </div>
                                </div>
                                <dl>
                                    <div>
                                        <dt>{t('deviceSettings.pairing.status.label')}</dt>
                                        <dd>
                                            {t(`deviceSettings.pairing.status.${paired}`)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('deviceSettings.pairing.mobile.label')}</dt>
                                        <dd>
                                            {t(`deviceSettings.pairing.mobile.${connected}`)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('deviceSettings.pairing.lock.label')}</dt>
                                        <dd>
                                            {t(`deviceSettings.pairing.lock.${lock}`)}
                                        </dd>
                                    </div>
                                </dl>
                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <MobilePairing deviceID={deviceID} deviceLocked={lock} mobilePaired={paired} />
                                    <DeviceLock
                                        deviceID={deviceID}
                                        onLock={() => this.setState({ lock: true })}
                                        disabled={lock || !paired} />
                                </div>

                                <hr />

                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.firmware.title')}</h3>
                                    </div>
                                </div>
                                <dl>
                                    <div>
                                        <dt>{t('deviceSettings.firmware.version.label')}</dt>
                                        <dd>{firmwareVersion ? firmwareVersion : t('loading')}</dd>
                                    </div>
                                    {canUpgrade && (
                                        <div>
                                            <dt>{t('deviceSettings.firmware.newVersion.label')}</dt>
                                            <dd>{newVersion}</dd>
                                        </div>
                                    ) || (
                                        <div>
                                            <dt></dt>
                                            <dd>{t('deviceSettings.firmware.upToDate')}</dd>
                                        </div>
                                    )}
                                </dl>
                                {canUpgrade && (
                                    <div class="buttons wrapped flex flex-row flex-start flex-baseline flex-wrap">
                                        <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                                    </div>
                                )}

                                <hr />

                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.hardware.title')}</h3>
                                    </div>
                                </div>
                                <dl>
                                    <div>
                                        <dt>{t('deviceSettings.hardware.sdcard.label')}</dt>
                                        <dd>{t(`deviceSettings.hardware.sdcard.${sdcard}`)}</dd>
                                    </div>
                                </dl>

                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <RandomNumber deviceID={deviceID} />
                                    <Blink deviceID={deviceID} />
                                </div>

                                <hr />

                            </div>
                        </div>
                        { spinner && <Spinner text={t('deviceSettings.loading')} /> }
                    </div>
                </div>
                <Guide guide={guide} screen="bitbox" />
            </div>
        );
    }
}
