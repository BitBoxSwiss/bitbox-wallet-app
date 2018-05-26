import { Component } from 'preact';
import { ButtonLink } from '../../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import Blink from './components/blink';
import RandomNumber from './components/randomnumber';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from './components/upgradefirmware';

@translate()

export default class Settings extends Component {
    state = {
        firmwareVersion: null,
        lock: true,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard, lock }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
                lock: lock,
            });
            // if (sdcard) alert('Keep the SD card stored securely unless you want to manage backups.');
        });
    }

    render({
        t,
        deviceID,
    }, {
        firmwareVersion,
        lock,
    }) {
        return (
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{t('deviceSettings.title')}</h2>
                    </div>
                </div>
                <div class="innerContainer">
                    <div class="content">
                        <h3>Device</h3>
                        <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                            <ButtonLink primary href={`/manage-backups/${deviceID}`} disabled={lock}>{t('device.manageBackups')}</ButtonLink>
                            <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                            <Reset deviceID={deviceID} />
                        </div>
                        <h3>Pairing</h3>
                        <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                            <MobilePairing deviceID={deviceID} disabled={lock}/>
                            <DeviceLock deviceID={deviceID} />
                        </div>
                        <h3>Miscellaneous</h3>
                        <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                            <Blink deviceID={deviceID} />
                            <RandomNumber deviceID={deviceID} />
                        </div>
                    </div>
                    <footer class={['flex', 'flex-row', 'flex-items-center', 'flex-end'].join(' ')}>
                        { firmwareVersion && <p>Firmware Version: {firmwareVersion}</p>}
                    </footer>
                </div>
            </div>
        );
    }
}
