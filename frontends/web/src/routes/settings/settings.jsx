import { Component } from 'preact';
import { ButtonLink } from '../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import UpgradeFirmware from './components/upgradefirmware';
import LanguageSwitch from './components/language-switch';
import componentStyle from '../../components/style.css';
import style from './settings.css';

@translate()

export default class Settings extends Component {
    state = {
        version: null,
        firmwareVersion: null,
    }

    componentDidMount() {
        apiGet('version').then(result => this.setState({ version: result }));
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard }) => {
            this.setState({ firmwareVersion: version.replace('v', '') });
            if (sdcard) alert('Keep the SD card stored securely unless you want to manage backups.');
        });
    }

    render({
        t,
        deviceID,
    }, {
        version,
        firmwareVersion,
    }) {
        return (
            <div class="container">
                <div class="innerContainer">
                    <div class="header">
                        <h2>Device Settings</h2>
                    </div>
                    <div class="content flex flex-column flex-start">
                        <div class={['flex', 'flex-row', 'flex-between', 'flex-1'].join(' ')}>
                            <ButtonLink primary href={`/manage-backups/${deviceID}`}>{t('device.manageBackups')}</ButtonLink>
                            <MobilePairing deviceID={deviceID} />
                            <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                            <Reset deviceID={deviceID} />
                        </div>
                        {
                            version && (
                                <div class={[style.version, 'flex', 'flex-row', 'flex-items-center', 'flex-end'].join(' ')}>
                                    <p>Firmware Version: {firmwareVersion || 'N/A'}</p>
                                    <p>App Version: {version}</p>
                                    <LanguageSwitch />
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>
        );
    }
}
