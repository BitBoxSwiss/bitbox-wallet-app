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
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from './components/upgradefirmware';

@translate()
export default class Settings extends Component {
    state = {
        firmwareVersion: null,
        newVersion: null,
        lock: true,
        name: null,
        serial: null,
        spinner: true,
        sdcard: false,
        paired: false,
        connected: false,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard, lock, name, serial }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
                lock, name, serial, sdcard,
                spinner: false,
            });
            // if (sdcard) alert('Keep the SD card stored securely unless you want to manage backups.');
        });

        apiGet('devices/' + this.props.deviceID + '/paired').then((paired) => {
            this.setState({ paired });
        });

        apiGet('devices/' + this.props.deviceID + '/bundled-firmware-version').then(version => {
            this.setState({ newVersion: version.replace('v', '') });
        });

        apiWebsocket(({ type, data }) => {
            if (type === 'device') {
                if (data === 'mobileDisconnected') {
                    this.setState({ connected: false });
                } else if (data === 'mobileConnected') {
                    this.setState({ connected: true });
                }
            }
        });
    }

    render({
        t,
        deviceID,
        guide,
    }, {
        firmwareVersion,
        newVersion,
        lock,
        name,
        spinner,
        sdcard,
        serial,
        paired,
        connected,
    }) {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <div class="header">
                            <h2>{name === null ? '' : name || 'BitBox'}</h2>
                        </div>
                    </div>
                    <div class="innerContainer scrollableContainer">
                        <div class="content">
                            <div class="flex-1">

                                <br />

                                <div class="subHeaderContainer first">
                                    <div class="subHeader">
                                        <h3>{t('deviceSettings.seed.title')}</h3>
                                    </div>
                                </div>
                                <div class="buttons wrapped flex flex-row flex-start flex-items-baseline flex-wrap">
                                    <ButtonLink primary href={`/manage-backups/${deviceID}`} disabled={lock}>
                                        {t('deviceSettings.seed.manageBackups')}
                                    </ButtonLink>
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
                                </dl>
                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <MobilePairing deviceID={deviceID} disabled={lock} />
                                    <DeviceLock deviceID={deviceID} disabled={lock} />
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
                                    {firmwareVersion && (newVersion !== firmwareVersion) && (
                                        <div>
                                            <dt>{t('deviceSettings.firmware.newVersion.label')}</dt>
                                            <dd>{newVersion}</dd>
                                        </div>
                                    )}
                                </dl>

                                <div class="buttons wrapped flex flex-row flex-start flex-baseline flex-wrap">
                                    <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} disabled={lock} />
                                </div>

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
                                    <div>
                                        <dt>{t('deviceSettings.hardware.serial.label')}</dt>
                                        <dd>{serial ? serial : t('loading')}</dd>
                                    </div>
                                </dl>

                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <RandomNumber deviceID={deviceID} />
                                    <Blink deviceID={deviceID} />
                                </div>

                                <hr />

                            </div>
                        </div>
                        { spinner && (<Spinner />)}
                    </div>
                </div>
                <Guide guide={guide} screen="bitbox" />
            </div>
        );
    }
}
