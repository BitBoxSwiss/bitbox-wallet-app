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

import { Component, h } from 'preact';
import { ButtonLink } from '../../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header } from '../../../components/header/Header';
import Spinner from '../../../components/spinner/Spinner';
import Blink from './components/blink';
import LegacyHiddenWallet from './components/legacyhiddenwallet';
import RandomNumber from './components/randomnumber';
import HiddenWallet from './components/hiddenwallet';
import ChangePIN from './components/changepin';
import Reset from './components/reset';
import { MobilePairing } from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from './components/upgradefirmware';

@translate()
export default class Settings extends Component {
    state = {
        firmwareVersion: null,
        newVersion: null,
        lock: true,
        name: null,
        spinner: true,
        sdcard: false,
        pairing: false,
        mobileChannel: false,
        connected: false,
        newHiddenWallet: true,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({
            version,
            sdcard,
            lock,
            name,
            new_hidden_wallet, // eslint-disable-line camelcase,
            pairing,
        }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
                lock, name, sdcard,
                spinner: false,
                newHiddenWallet: new_hidden_wallet,
                pairing,
            });
        });

        apiGet('devices/' + this.props.deviceID + '/has-mobile-channel').then(mobileChannel => {
            this.setState({ mobileChannel });
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
                    this.setState({ pairing: true, mobileChannel: true });
                    break;
                case 'pairingFalse':
                    this.setState({ mobileChannel: false });
                    break;
                }
            }
        });
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    render({
        t,
        deviceID,
    }, {
        firmwareVersion,
        newVersion,
        lock,
        name,
        spinner,
        sdcard,
        pairing,
        mobileChannel,
        connected,
        newHiddenWallet,
    }) {
        const canUpgrade = firmwareVersion && newVersion !== firmwareVersion;
        const paired = pairing && mobileChannel;
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{name === null ? '' : name || 'BitBox'}</h2>} {...this.props} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="flex-1">
                                <div class="subHeaderContainer first">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.secrets.title')}</h3>
                                    </div>
                                </div>
                                <div class="buttons flex-row flex-start flex-items-baseline flex-wrap">
                                    <ButtonLink primary href={`/manage-backups/${deviceID}`} disabled={lock}>
                                        {t('deviceSettings.secrets.manageBackups')}
                                    </ButtonLink>
                                    <ChangePIN deviceID={deviceID} />
                                    {
                                        newHiddenWallet ? (
                                            <HiddenWallet deviceID={deviceID} disabled={lock} />
                                        ) : (
                                            <LegacyHiddenWallet
                                                deviceID={deviceID}
                                                newHiddenWallet={newHiddenWallet}
                                                disabled={lock}
                                                onChange={value => this.setState({ newHiddenWallet: value })}
                                            />
                                        )
                                    }
                                    <Reset deviceID={deviceID} />
                                </div>

                                <hr />

                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.pairing.title')}</h3>
                                    </div>
                                </div>
                                <dl class="items marginBottom">
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
                                <div class="buttons flex flex-row flex-start flex-wrap">
                                    <MobilePairing
                                        deviceID={deviceID}
                                        deviceLocked={lock}
                                        hasMobileChannel={mobileChannel}
                                        paired={paired}
                                        onPairingEnabled={() => this.setState({ pairing: true })}
                                    />
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
                                <dl class="items">
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
                                    <div class="buttons flex flex-row flex-start flex-baseline flex-wrap">
                                        <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                                    </div>
                                )}

                                <hr />

                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.hardware.title')}</h3>
                                    </div>
                                </div>
                                <dl class="items marginBottom">
                                    <div>
                                        <dt>{t('deviceSettings.hardware.sdcard.label')}</dt>
                                        <dd>{t(`deviceSettings.hardware.sdcard.${sdcard}`)}</dd>
                                    </div>
                                </dl>

                                <div class="buttons flex flex-row flex-start flex-wrap">
                                    <RandomNumber deviceID={deviceID} />
                                    <Blink deviceID={deviceID} />
                                </div>

                                <hr />

                            </div>
                        </div>
                        { spinner && <Spinner text={t('deviceSettings.loading')} /> }
                    </div>
                </div>
                <Guide>
                    <Entry key="guide.bitbox.ejectBitbox" entry={t('guide.bitbox.ejectBitbox')} />
                    <Entry key="guide.bitbox.ejectSD" entry={t('guide.bitbox.ejectSD')} />
                    <Entry key="guide.bitbox.hiddenWallet" entry={t('guide.bitbox.hiddenWallet')} />
                    { !lock && newHiddenWallet && (
                        <Entry key="guide.bitbox.legacyHiddenWallet" entry={t('guide.bitbox.legacyHiddenWallet')}>
                            <p>
                                <LegacyHiddenWallet
                                    deviceID={deviceID}
                                    newHiddenWallet={newHiddenWallet}
                                    onChange={value => this.setState({ newHiddenWallet: value })}
                                />
                            </p>
                        </Entry>
                    )}
                    <Entry key="guide.bitbox.pairing" entry={t('guide.bitbox.pairing')} />
                    <Entry key="guide.bitbox.2FA" entry={t('guide.bitbox.2FA')} />
                    <Entry key="guide.bitbox.disable2FA" entry={t('guide.bitbox.disable2FA')} />
                </Guide>
            </div>
        );
    }
}
