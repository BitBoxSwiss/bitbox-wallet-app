import { Component } from 'preact';
import { ButtonLink } from '../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import UpgradeFirmware from './components/upgradefirmware';
import Footer from '../../components/footer/footer';

@translate()
export default class Settings extends Component {
    state = {
        firmwareVersion: null,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard }) => {
            this.setState({ firmwareVersion: version.replace('v', '') });
            if (sdcard) alert('Keep the SD card stored securely unless you want to manage backups.');
        });
    }

    render({
        t,
        deviceID,
    }, {
        firmwareVersion,
    }) {
        return (
            <div class="container">
                <div class="innerContainer">
                    <div class="header">
                        <h2>{t('settings.title')}</h2>
                    </div>
                    <div class="content flex flex-column flex-start">
                        <div class={['flex', 'flex-row', 'flex-between', 'flex-1'].join(' ')}>
                            <ButtonLink primary href={`/manage-backups/${deviceID}`}>{t('device.manageBackups')}</ButtonLink>
                            <MobilePairing deviceID={deviceID} />
                            <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                            <Reset deviceID={deviceID} />
                        </div>
                        <Footer>
                            { firmwareVersion && <p>Firmware Version: {firmwareVersion}</p>}
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
